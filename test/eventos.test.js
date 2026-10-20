require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { DateTime } = require('luxon');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { FUSO } = require('../src/lib/tempo');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;
let ana;
let bia;

const consulta = (extra = {}) => ({
  titulo: 'Cardiologista',
  tipo: 'consulta',
  modalidade: 'presencial',
  inicio: '2026-10-20T10:00:00-03:00',
  fim: '2026-10-20T10:30:00-03:00',
  local: 'Clínica Centro',
  lembretesMinutosAntes: [1080, 120],
  ...extra,
});

const criar = (sessao, dados, status = 201) =>
  request(app).post('/eventos').set(sessao.auth).send(dados).expect(status);

const listar = async (sessao, query) =>
  (await request(app).get('/eventos').query(query).set(sessao.auth).expect(200)).body;

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

test('cria evento e devolve a série com lembretes em lista', async () => {
  const { body } = await criar(ana, consulta({ link: '' }));
  assert.equal(body.titulo, 'Cardiologista');
  assert.equal(body.inicio, '2026-10-20T10:00:00-03:00');
  assert.equal(body.fim, '2026-10-20T10:30:00-03:00');
  assert.deepEqual(body.lembretesMinutosAntes, [1080, 120]);
  assert.equal(body.link, null);
  assert.equal(body.recorrente, false);
  assert.equal(body.inicioSerie, body.inicio);
  assert.equal('usuarioId' in body, false);
});

test('aceita horário em UTC e devolve no fuso de São Paulo', async () => {
  const { body } = await criar(ana, consulta({ inicio: '2026-10-21T13:00:00Z', fim: null }));
  assert.equal(body.inicio, '2026-10-21T10:00:00-03:00');
});

test('validações do corpo', async () => {
  const casos = [
    [{ fim: '2026-10-20T09:00:00-03:00' }, /fim: O fim precisa ser depois do início/],
    [{ inicio: '2026-10-20T10:00:00' }, /inicio: Data e hora inválidas/],
    [{ link: 'javascript:alert(1)' }, /link: Link inválido/],
    [{ lembretesMinutosAntes: [60, 60] }, /lembretesMinutosAntes: Há lembretes repetidos/],
    [{ lembretesMinutosAntes: [1, 2, 3, 4, 5, 6] }, /No máximo 5 lembretes/],
    [{ lembretesMinutosAntes: [0] }, /O lembrete precisa ser antes do evento/],
    [{ recorrenciaFim: '2026-12-31' }, /recorrenciaFim: Só eventos recorrentes/],
    [{ recorrencia: 'semanal', recorrenciaFim: '2026-10-01' }, /A repetição precisa terminar depois do início/],
    [{ tipo: 'festa' }, /tipo/],
  ];
  for (const [extra, mensagem] of casos) {
    const res = await criar(ana, consulta(extra), 400);
    assert.equal(res.body.erro.codigo, 'VALIDACAO');
    assert.match(res.body.erro.mensagem, mensagem);
  }
});

test('listagem expande recorrentes, respeita o período e ordena por início', async () => {
  const sessao = await criarSessao(app);
  const { body: fisio } = await criar(sessao, {
    titulo: 'Fisioterapia',
    tipo: 'fisioterapia',
    inicio: '2026-11-02T08:00:00-03:00',
    fim: '2026-11-02T09:00:00-03:00',
    recorrencia: 'semanal',
    recorrenciaFim: '2026-11-23',
  });
  await criar(sessao, consulta({ inicio: '2026-11-10T14:00:00-03:00', fim: null }));
  await criar(sessao, consulta({ titulo: 'Fora', inicio: '2026-12-15T14:00:00-03:00', fim: null }));

  const novembro = await listar(sessao, { inicio: '2026-11-01', fim: '2026-11-30' });
  assert.deepEqual(
    novembro.map((e) => `${e.inicio.slice(0, 16)} ${e.titulo}`),
    [
      '2026-11-02T08:00 Fisioterapia',
      '2026-11-09T08:00 Fisioterapia',
      '2026-11-10T14:00 Cardiologista',
      '2026-11-16T08:00 Fisioterapia',
      '2026-11-23T08:00 Fisioterapia',
    ],
  );
  const ocorrencia = novembro[1];
  assert.equal(ocorrencia.id, fisio.id, 'ocorrência carrega o id da série');
  assert.equal(ocorrencia.recorrente, true);
  assert.equal(ocorrencia.fim, '2026-11-09T09:00:00-03:00');
  assert.equal(ocorrencia.inicioSerie, '2026-11-02T08:00:00-03:00');

  const soFisio = await listar(sessao, { inicio: '2026-11-01', fim: '2026-11-30', tipo: 'fisioterapia' });
  assert.equal(soFisio.length, 4);
});

test('evento que atravessa a meia-noite aparece no dia seguinte', async () => {
  const sessao = await criarSessao(app);
  await criar(sessao, {
    titulo: 'Gravação noturna',
    tipo: 'video',
    modalidade: 'gravacao',
    inicio: '2026-11-05T23:00:00-03:00',
    fim: '2026-11-06T01:00:00-03:00',
  });
  assert.equal((await listar(sessao, { inicio: '2026-11-06', fim: '2026-11-06' })).length, 1);
  assert.equal((await listar(sessao, { inicio: '2026-11-07', fim: '2026-11-07' })).length, 0);
});

test('sem período, lista de hoje até 30 dias à frente', async () => {
  const sessao = await criarSessao(app);
  const amanha = DateTime.now().setZone(FUSO).plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  await criar(sessao, consulta({ inicio: amanha.toISO({ suppressMilliseconds: true }), fim: null }));
  await criar(sessao, consulta({ titulo: 'Longe', inicio: amanha.plus({ days: 60 }).toISO({ suppressMilliseconds: true }), fim: null }));
  const lista = await listar(sessao, {});
  assert.deepEqual(lista.map((e) => e.titulo), ['Cardiologista']);
});

test('período inválido ou longo demais devolve 400', async () => {
  const invertido = await request(app).get('/eventos').query({ inicio: '2026-11-10', fim: '2026-11-01' }).set(ana.auth).expect(400);
  assert.match(invertido.body.erro.mensagem, /fim: O início precisa ser anterior/);
  const longo = await request(app).get('/eventos').query({ inicio: '2026-01-01', fim: '2027-06-01' }).set(ana.auth).expect(400);
  assert.match(longo.body.erro.mensagem, /no máximo 366 dias/);
});

test('PUT edita a série, DELETE remove, e lembretes pendentes são cancelados', async () => {
  const { body: evento } = await criar(ana, consulta());
  const [lembrete] = await db('lembreteEnvio')
    .insert({
      usuarioId: ana.usuario.id,
      origemTipo: 'evento',
      origemId: evento.id,
      ocorrencia: evento.inicio,
      canal: 'app',
      agendadoPara: '2026-10-19T16:00:00-03:00',
    })
    .returning('*');

  const editado = await request(app)
    .put(`/eventos/${evento.id}`)
    .set(ana.auth)
    .send(consulta({ titulo: 'Cardiologista (remarcado)', inicio: '2026-10-22T15:00:00-03:00', fim: null }))
    .expect(200);
  assert.equal(editado.body.titulo, 'Cardiologista (remarcado)');
  assert.equal(editado.body.inicio, '2026-10-22T15:00:00-03:00');
  assert.equal((await db('lembreteEnvio').where({ id: lembrete.id }).first()).status, 'cancelado');

  const lido = await request(app).get(`/eventos/${evento.id}`).set(ana.auth).expect(200);
  assert.equal(lido.body.titulo, 'Cardiologista (remarcado)');

  await request(app).delete(`/eventos/${evento.id}`).set(ana.auth).expect(204);
  await request(app).get(`/eventos/${evento.id}`).set(ana.auth).expect(404);
});

test('isolamento entre usuários', async () => {
  const { body: evento } = await criar(ana, consulta({ inicio: '2026-10-25T10:00:00-03:00', fim: null }));
  await request(app).get(`/eventos/${evento.id}`).set(bia.auth).expect(404);
  await request(app).put(`/eventos/${evento.id}`).set(bia.auth).send(consulta()).expect(404);
  await request(app).delete(`/eventos/${evento.id}`).set(bia.auth).expect(404);
  const daBia = await listar(bia, { inicio: '2026-10-01', fim: '2026-10-31' });
  assert.equal(daBia.length, 0);
  await request(app).get('/eventos').expect(401);
});

test('tipos novos; "outro" exige a descrição (API e banco) e a guarda; trocar de tipo a apaga', async () => {
  const sessao = await criarSessao(app);
  const base = { titulo: 'Compromisso', inicio: '2099-05-10T10:00:00-03:00' };
  for (const tipo of ['videoconferencia', 'podcast', 'gravacao', 'entrevista']) {
    await request(app).post('/eventos').set(sessao.auth).send({ ...base, tipo }).expect(201);
  }

  const semDescricao = await request(app).post('/eventos').set(sessao.auth).send({ ...base, tipo: 'outro' }).expect(400);
  assert.match(semDescricao.body.erro.mensagem, /tipoDescricao: Descreva o compromisso/);
  await request(app).post('/eventos').set(sessao.auth).send({ ...base, tipo: 'outro', tipoDescricao: '   ' }).expect(400);

  const outro = (
    await request(app).post('/eventos').set(sessao.auth).send({ ...base, tipo: 'outro', tipoDescricao: '  Aula de canto ' }).expect(201)
  ).body;
  assert.equal(outro.tipoDescricao, 'Aula de canto');
  assert.equal((await request(app).get(`/eventos/${outro.id}`).set(sessao.auth)).body.tipoDescricao, 'Aula de canto');

  const virouReuniao = (
    await request(app)
      .put(`/eventos/${outro.id}`)
      .set(sessao.auth)
      .send({ ...base, tipo: 'reuniao_pessoal', tipoDescricao: 'Aula de canto' })
      .expect(200)
  ).body;
  assert.equal(virouReuniao.tipoDescricao, null);

  // O banco também recusa "outro" sem descrição (mesmo fora da API).
  await assert.rejects(
    db('evento').where({ id: outro.id }).update({ tipo: 'outro', tipoDescricao: null }),
    /evento_tipo_descricao_check/,
  );
});
