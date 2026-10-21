require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { hoje } = require('../src/lib/tempo');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

// 2026-10-18 é domingo (0); 2026-10-19, segunda (1).
const DOMINGO = '2026-10-18';
const SEGUNDA = '2026-10-19';

let app;
let ana;
let bia;

const criar = (sessao, dados, status = 201) =>
  request(app).post('/rotinas').set(sessao.auth).send(dados).expect(status);

const doDia = async (sessao, data) =>
  (await request(app).get('/rotinas/hoje').query(data ? { data } : {}).set(sessao.auth).expect(200)).body;

const concluir = (sessao, id, corpo = {}, status = 200) =>
  request(app).post(`/rotinas/${id}/concluir`).set(sessao.auth).send(corpo).expect(status);

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

test('cria tarefa com padrões (todos os dias, ativa, sem lembrete)', async () => {
  const { body } = await criar(ana, { titulo: 'Ler WhatsApp' });
  assert.deepEqual(body.diasSemana, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(body.ativo, true);
  assert.equal(body.lembrete, false);
  assert.equal(body.hora, null);
  assert.equal(body.ordem, 0);
});

test('validações', async () => {
  const casos = [
    [{ titulo: '' }, /titulo: Informe o título/],
    [{ titulo: 'X', diasSemana: [] }, /Escolha pelo menos um dia/],
    [{ titulo: 'X', diasSemana: [1, 1] }, /Há dias repetidos/],
    [{ titulo: 'X', diasSemana: [7] }, /diasSemana/],
    [{ titulo: 'X', lembrete: true }, /hora: Para receber lembrete, informe a hora/],
    [{ titulo: 'X', hora: '9h' }, /hora: Hora inválida/],
  ];
  for (const [corpo, mensagem] of casos) {
    const res = await criar(ana, corpo, 400);
    assert.match(res.body.erro.mensagem, mensagem);
  }
});

test('/hoje mostra só tarefas ativas do dia da semana, na ordem definida', async () => {
  const sessao = await criarSessao(app);
  await criar(sessao, { titulo: 'Enviar mensagens', hora: '18:00', ordem: 2 });
  await criar(sessao, { titulo: 'Ler e-mails', hora: '09:00', diasSemana: [5, 1, 2, 3, 4], ordem: 1 });
  await criar(sessao, { titulo: 'Ler WhatsApp', ordem: 1 });
  await criar(sessao, { titulo: 'Pausada', ativo: false });

  const segunda = await doDia(sessao, SEGUNDA);
  assert.deepEqual(segunda.map((i) => i.titulo), ['Ler e-mails', 'Ler WhatsApp', 'Enviar mensagens']);
  assert.ok(segunda.every((i) => i.concluida === false && i.data === SEGUNDA));

  const domingo = await doDia(sessao, DOMINGO);
  assert.deepEqual(domingo.map((i) => i.titulo), ['Ler WhatsApp', 'Enviar mensagens']);

  assert.ok((await doDia(sessao)).every((i) => i.data === hoje()));
});

test('concluir é idempotente, por dia, e pode ser desfeito', async () => {
  const sessao = await criarSessao(app);
  const { body: tarefa } = await criar(sessao, { titulo: 'Verificar pagamentos', diasSemana: [1] });

  const feito = await concluir(sessao, tarefa.id, { data: SEGUNDA });
  assert.equal(feito.body.concluida, true);
  assert.match(feito.body.concluidaEm, /-03:00$/);
  await concluir(sessao, tarefa.id, { data: SEGUNDA });
  assert.equal((await db('rotinaConclusao').where({ rotinaId: tarefa.id })).length, 1);

  assert.equal((await doDia(sessao, SEGUNDA))[0].concluida, true);
  assert.equal((await doDia(sessao, '2026-10-26'))[0].concluida, false, 'outra segunda começa desmarcada');

  const desfeito = await concluir(sessao, tarefa.id, { data: SEGUNDA, concluida: false });
  assert.equal(desfeito.body.concluida, false);

  const foraDoDia = await concluir(sessao, tarefa.id, { data: DOMINGO }, 400);
  assert.match(foraDoDia.body.erro.mensagem, /não está prevista para esse dia/);
});

test('editar cancela lembretes pendentes; isolamento e exclusão', async () => {
  const { body: tarefa } = await criar(ana, { titulo: 'Ler e-mails', hora: '09:00', lembrete: true });
  await db('lembreteEnvio').insert({
    usuarioId: ana.usuario.id,
    origemTipo: 'rotina',
    origemId: tarefa.id,
    ocorrencia: '2026-10-19T09:00:00-03:00',
    canal: 'app',
    agendadoPara: '2026-10-19T09:00:00-03:00',
  });

  const editado = await request(app)
    .put(`/rotinas/${tarefa.id}`)
    .set(ana.auth)
    .send({ titulo: 'Ler e-mails (manhã)', hora: '08:30', lembrete: true })
    .expect(200);
  assert.equal(editado.body.hora, '08:30');
  assert.equal((await db('lembreteEnvio').where({ origemId: tarefa.id }).first()).status, 'cancelado');

  await request(app).put(`/rotinas/${tarefa.id}`).set(bia.auth).send({ titulo: 'X' }).expect(404);
  await concluir(bia, tarefa.id, {}, 404);
  await request(app).delete(`/rotinas/${tarefa.id}`).set(bia.auth).expect(404);
  assert.ok(!(await request(app).get('/rotinas').set(bia.auth)).body.some((r) => r.id === tarefa.id));

  await request(app).delete(`/rotinas/${tarefa.id}`).set(ana.auth).expect(204);
  await request(app).delete(`/rotinas/${tarefa.id}`).set(ana.auth).expect(404);
  await request(app).get('/rotinas/hoje').expect(401);
});

test('observações e histórico (feito, não feito na tela Hoje e isolamento)', async () => {
  const sessao = await criarSessao(app);
  const { body: rotina } = await criar(sessao, { titulo: 'Ler e-mails', hora: '09:00', observacoes: '  Caixa do trabalho ' });
  assert.equal(rotina.observacoes, 'Caixa do trabalho');

  await concluir(sessao, rotina.id, { data: DOMINGO });
  await request(app)
    .patch(`/hoje/compromisso:${rotina.id}:${SEGUNDA}T09:00`)
    .set(sessao.auth)
    .send({ status: 'nao_feito' })
    .expect(200);

  const { body: historico } = await request(app)
    .get(`/rotinas/${rotina.id}/historico`)
    .query({ inicio: '2026-10-01', fim: '2026-10-31' })
    .set(sessao.auth)
    .expect(200);
  assert.deepEqual(
    historico.map((h) => [h.data, h.situacao]),
    [
      [SEGUNDA, 'nao_feito'],
      [DOMINGO, 'feito'],
    ],
  );
  assert.match(historico[0].em, /-03:00$/);

  // Feito depois do ✗ no mesmo dia: vale o feito.
  await concluir(sessao, rotina.id, { data: SEGUNDA });
  const depois = (
    await request(app).get(`/rotinas/${rotina.id}/historico`).query({ inicio: SEGUNDA, fim: SEGUNDA }).set(sessao.auth)
  ).body;
  assert.deepEqual(depois.map((h) => h.situacao), ['feito']);

  await request(app).get(`/rotinas/${rotina.id}/historico`).set(bia.auth).expect(404);
  await request(app)
    .get(`/rotinas/${rotina.id}/historico`)
    .query({ inicio: '2026-10-31', fim: '2026-10-01' })
    .set(sessao.auth)
    .expect(400);
});
