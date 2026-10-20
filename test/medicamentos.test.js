require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { hoje } = require('../src/lib/tempo');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

// 2026-10-19 é segunda-feira (diaSemana 1); 2026-10-20, terça.
const SEGUNDA = '2026-10-19';
const TERCA = '2026-10-20';

let app;
let ana;
let bia;

const losartana = (extra = {}) => ({
  nome: 'Losartana',
  dose: '1 comprimido de 50 mg',
  horarios: [
    { periodo: 'noite', hora: '20:00' },
    { periodo: 'manha', hora: '08:00' },
    { periodo: 'semanal', hora: '09:00', diaSemana: 1 },
  ],
  ...extra,
});

const criar = (sessao, dados, status = 201) =>
  request(app).post('/medicamentos').set(sessao.auth).send(dados).expect(status);

const doDia = async (sessao, data) =>
  (await request(app).get('/medicamentos/hoje').query(data ? { data } : {}).set(sessao.auth).expect(200)).body;

const registrar = (sessao, corpo, status = 200) =>
  request(app).post('/medicamentos/registros').set(sessao.auth).send(corpo).expect(status);

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

test('cria medicamento com horários ordenados por período', async () => {
  const { body } = await criar(ana, losartana());
  assert.equal(body.nome, 'Losartana');
  assert.equal(body.ativo, true);
  assert.equal(body.observacoes, null);
  assert.deepEqual(
    body.horarios.map((h) => [h.periodo, h.hora, h.diaSemana]),
    [
      ['manha', '08:00', null],
      ['noite', '20:00', null],
      ['semanal', '09:00', 1],
    ],
  );
});

test('validações de horários', async () => {
  const casos = [
    [{ horarios: [] }, /Cadastre pelo menos um horário/],
    [{ horarios: [{ periodo: 'semanal', hora: '09:00' }] }, /diaSemana: Informe o dia da semana/],
    [{ horarios: [{ periodo: 'manha', diaSemana: 2 }] }, /diaSemana: Dia da semana só vale para o período semanal/],
    [{ horarios: [{ periodo: 'manha', hora: '25:00' }] }, /hora: Hora inválida/],
    [{ horarios: [{ periodo: 'madrugada' }] }, /periodo/],
    [{ nome: '' }, /nome: Informe o nome do remédio/],
  ];
  for (const [extra, mensagem] of casos) {
    const res = await criar(ana, losartana(extra), 400);
    assert.match(res.body.erro.mensagem, mensagem);
  }
});

test('/hoje traz diários todo dia e semanais só no dia da semana; ignora inativos', async () => {
  const sessao = await criarSessao(app);
  await criar(sessao, losartana());
  await criar(sessao, losartana({ nome: 'Suspenso', ativo: false }));

  const segunda = await doDia(sessao, SEGUNDA);
  assert.deepEqual(
    segunda.map((i) => `${i.periodo} ${i.hora} ${i.nome}`),
    ['manha 08:00 Losartana', 'noite 20:00 Losartana', 'semanal 09:00 Losartana'],
  );
  assert.ok(segunda.every((i) => i.tomado === false && i.tomadoEm === null && i.data === SEGUNDA));

  const terca = await doDia(sessao, TERCA);
  assert.deepEqual(terca.map((i) => i.periodo), ['manha', 'noite']);

  const semData = await doDia(sessao);
  assert.ok(semData.every((i) => i.data === hoje()));
});

test('marcar como tomado é idempotente e pode ser desfeito', async () => {
  const sessao = await criarSessao(app);
  const { body: med } = await criar(sessao, losartana());
  const manha = med.horarios.find((h) => h.periodo === 'manha');

  const marcado = await registrar(sessao, { horarioId: manha.id, data: TERCA });
  assert.equal(marcado.body.tomado, true);
  assert.match(marcado.body.tomadoEm, /-03:00$/);

  await registrar(sessao, { horarioId: manha.id, data: TERCA });
  const registros = await db('medicamentoRegistro').where({ medicamentoHorarioId: manha.id });
  assert.equal(registros.length, 1, 'marcar de novo não duplica');

  const terca = await doDia(sessao, TERCA);
  assert.equal(terca.find((i) => i.horarioId === manha.id).tomado, true);
  assert.equal((await doDia(sessao, SEGUNDA)).find((i) => i.horarioId === manha.id).tomado, false);

  const desfeito = await registrar(sessao, { horarioId: manha.id, data: TERCA, tomado: false });
  assert.equal(desfeito.body.tomado, false);
  assert.equal(desfeito.body.tomadoEm, null);
});

test('registro de semanal fora do dia é recusado; horário de outro usuário dá 404', async () => {
  const { body: med } = await criar(ana, losartana());
  const semanal = med.horarios.find((h) => h.periodo === 'semanal');
  const res = await registrar(ana, { horarioId: semanal.id, data: TERCA }, 400);
  assert.match(res.body.erro.mensagem, /não é tomado nesse dia da semana/);
  await registrar(ana, { horarioId: semanal.id, data: SEGUNDA });

  await registrar(bia, { horarioId: semanal.id, data: SEGUNDA }, 404);
});

test('PUT mantém horários com id (e histórico), cria novos e remove os ausentes', async () => {
  const sessao = await criarSessao(app);
  const { body: med } = await criar(sessao, losartana());
  const manha = med.horarios.find((h) => h.periodo === 'manha');
  const noite = med.horarios.find((h) => h.periodo === 'noite');
  await registrar(sessao, { horarioId: manha.id, data: TERCA });
  await db('lembreteEnvio').insert({
    usuarioId: sessao.usuario.id,
    origemTipo: 'medicamento_horario',
    origemId: noite.id,
    ocorrencia: '2026-10-20T20:00:00-03:00',
    canal: 'app',
    agendadoPara: '2026-10-20T20:00:00-03:00',
  });

  const { body: editado } = await request(app)
    .put(`/medicamentos/${med.id}`)
    .set(sessao.auth)
    .send({
      nome: 'Losartana 100',
      horarios: [
        { id: manha.id, periodo: 'manha', hora: '07:30' },
        { periodo: 'tarde', hora: '14:00' },
      ],
    })
    .expect(200);

  assert.equal(editado.nome, 'Losartana 100');
  assert.equal(editado.dose, null);
  assert.deepEqual(editado.horarios.map((h) => [h.periodo, h.hora]), [
    ['manha', '07:30'],
    ['tarde', '14:00'],
  ]);
  assert.equal(editado.horarios[0].id, manha.id);
  assert.equal(
    (await doDia(sessao, TERCA)).find((i) => i.horarioId === manha.id).tomado,
    true,
    'histórico do horário mantido',
  );
  assert.equal(await db('medicamentoHorario').where({ id: noite.id }).first(), undefined);
  const lembrete = await db('lembreteEnvio').where({ origemId: noite.id }).first();
  assert.equal(lembrete.status, 'cancelado');

  const idAlheio = await request(app)
    .put(`/medicamentos/${med.id}`)
    .set(sessao.auth)
    .send({ nome: 'X', horarios: [{ id: '00000000-0000-4000-8000-000000000000', periodo: 'manha' }] })
    .expect(400);
  assert.match(idAlheio.body.erro.mensagem, /horarios\.0\.id: horário não encontrado/);
});

test('lista, isolamento e exclusão', async () => {
  const sessao = await criarSessao(app);
  const { body: med } = await criar(sessao, losartana());
  await criar(sessao, losartana({ nome: 'AAS' }));

  const lista = await request(app).get('/medicamentos').set(sessao.auth).expect(200);
  assert.deepEqual(lista.body.map((m) => m.nome), ['AAS', 'Losartana']);

  await request(app).get(`/medicamentos/${med.id}`).set(bia.auth).expect(404);
  await request(app).put(`/medicamentos/${med.id}`).set(bia.auth).send(losartana()).expect(404);
  await request(app).delete(`/medicamentos/${med.id}`).set(bia.auth).expect(404);

  await request(app).delete(`/medicamentos/${med.id}`).set(sessao.auth).expect(204);
  await request(app).get(`/medicamentos/${med.id}`).set(sessao.auth).expect(404);
  await request(app).get('/medicamentos/hoje').expect(401);
});

test('período de uso: fora do início/fim não aparece no dia nem aceita registro', async () => {
  const sessao = await criarSessao(app);
  const { body: med } = await criar(
    sessao,
    losartana({ dataInicio: TERCA, dataFim: '2026-10-22', intervaloHoras: 12 }),
  );
  assert.equal(med.dataInicio, TERCA);
  assert.equal(med.dataFim, '2026-10-22');
  assert.equal(med.intervaloHoras, 12);

  assert.equal((await doDia(sessao, SEGUNDA)).length, 0, 'antes do início');
  assert.equal((await doDia(sessao, TERCA)).length, 2);
  assert.equal((await doDia(sessao, '2026-10-23')).length, 0, 'depois do fim');

  const manha = med.horarios.find((h) => h.periodo === 'manha');
  const fora = await registrar(sessao, { horarioId: manha.id, data: '2026-10-23' }, 400);
  assert.match(fora.body.erro.mensagem, /fora do período de uso/);

  const invertido = await criar(sessao, losartana({ dataInicio: TERCA, dataFim: SEGUNDA }), 400);
  assert.match(invertido.body.erro.mensagem, /dataFim: O fim do uso precisa ser/);
  await criar(sessao, losartana({ intervaloHoras: 25 }), 400);

  // Sem período, vale todo dia (como os remédios cadastrados antes).
  const { body: semPeriodo } = await criar(sessao, losartana({ nome: 'AAS' }));
  assert.equal(semPeriodo.dataInicio, null);
  assert.equal(semPeriodo.intervaloHoras, null);
});

test('dose não tomada: situação, troca para tomada e volta para pendente', async () => {
  const sessao = await criarSessao(app);
  const { body: med } = await criar(sessao, losartana());
  const manha = med.horarios.find((h) => h.periodo === 'manha');
  const situacao = async () => (await doDia(sessao, TERCA)).find((i) => i.horarioId === manha.id).situacao;

  assert.equal(await situacao(), 'pendente');
  const nao = await registrar(sessao, { horarioId: manha.id, data: TERCA, situacao: 'nao_tomado' });
  assert.equal(nao.body.situacao, 'nao_tomado');
  assert.equal(nao.body.tomado, false);

  // A tela Hoje mostra o mesmo ✗.
  const hojeTerca = await request(app).get('/hoje').query({ data: TERCA }).set(sessao.auth).expect(200);
  const naTelaHoje = hojeTerca.body.tarefas.find((t) => t.id === `remedio:${manha.id}:${TERCA}T08:00`);
  assert.equal(naTelaHoje.status, 'nao_feito');

  await registrar(sessao, { horarioId: manha.id, data: TERCA, situacao: 'tomado' });
  assert.equal(await situacao(), 'tomado');
  await registrar(sessao, { horarioId: manha.id, data: TERCA, situacao: 'nao_tomado' });
  assert.equal(await situacao(), 'nao_tomado');
  assert.equal(
    (await db('medicamentoRegistro').where({ medicamentoHorarioId: manha.id })).length,
    0,
    'não tomada apaga o "tomei"',
  );
  await registrar(sessao, { horarioId: manha.id, data: TERCA, situacao: 'pendente' });
  assert.equal(await situacao(), 'pendente');
  assert.equal((await db('tarefaRegistro').where({ itemId: manha.id })).length, 0);
});
