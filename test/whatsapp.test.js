require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { DateTime } = require('luxon');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { FUSO } = require('../src/lib/tempo');
const whatsapp = require('../src/lembretes/canais/whatsapp');
const { gerar, enviarPendentes } = require('../src/lembretes/agendador');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

const em = (iso) => DateTime.fromISO(iso, { zone: FUSO });

let app;
let ana;
let bia;

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const aceita = () => json({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.teste' }] });
const erroDaMeta = (code, status = 400) => () => json({ error: { message: `Erro ${code}`, code } }, status);

/** Troca o fetch pela "Meta" e devolve as chamadas feitas a ela. */
function simularMeta(t, responder = aceita) {
  const chamadas = [];
  t.mock.method(globalThis, 'fetch', async (url, opcoes) => {
    chamadas.push({ url, autorizacao: opcoes.headers.Authorization, corpo: JSON.parse(opcoes.body) });
    return responder();
  });
  return chamadas;
}

const salvar = (sessao, numero, status = 200) =>
  request(app).put('/notificacoes/whatsapp').set(sessao.auth).send({ numero }).expect(status);

test('cadastra o número como a pessoa escreve e guarda só os dígitos com o código do país', async () => {
  const { body: vazio } = await request(app).get('/notificacoes/whatsapp').set(ana.auth).expect(200);
  assert.deepEqual(vazio, { disponivel: true, numero: null });

  assert.equal((await salvar(ana, '(11) 98765-4321')).body.numero, '5511987654321');
  assert.equal((await salvar(ana, '+55 21 3333-4444')).body.numero, '552133334444');
  assert.equal((await salvar(ana, '011 98765-4321')).body.numero, '5511987654321');
  assert.equal((await salvar(ana, '+1 415 555 0100')).body.numero, '14155550100');

  const { body: erro } = await salvar(ana, '9876-543', 400);
  assert.equal(erro.erro.codigo, 'VALIDACAO');
  assert.match(erro.erro.mensagem, /DDD/);

  // Cada um vê só o seu.
  assert.equal((await request(app).get('/notificacoes/whatsapp').set(bia.auth)).body.numero, null);
  await request(app).get('/notificacoes/whatsapp').expect(401);
});

test('mensagem de teste: o modelo da Meta com título e detalhe', async (t) => {
  await salvar(bia, null);
  const semNumero = await request(app).post('/notificacoes/whatsapp/teste').set(bia.auth).expect(409);
  assert.equal(semNumero.body.erro.codigo, 'SEM_WHATSAPP');

  await salvar(ana, '(11) 98765-4321');
  const chamadas = simularMeta(t);
  await request(app).post('/notificacoes/whatsapp/teste').set(ana.auth).expect(204);
  assert.equal(chamadas.length, 1);
  const [{ url, autorizacao, corpo }] = chamadas;
  assert.equal(url, 'https://graph.facebook.com/v23.0/100000000000001/messages');
  assert.equal(autorizacao, 'Bearer token-de-teste');
  assert.equal(corpo.to, '5511987654321');
  assert.equal(corpo.type, 'template');
  assert.equal(corpo.template.name, 'lembrete');
  assert.deepEqual(corpo.template.language, { code: 'pt_BR' });
  assert.deepEqual(
    corpo.template.components[0].parameters.map((p) => p.text),
    ['Avisos ligados', 'É assim que os lembretes da Minha Assistente vão chegar aqui.'],
  );
});

test('mensagem de teste: número recusado, Meta fora do ar e servidor sem WhatsApp', async (t) => {
  await salvar(ana, '(11) 98765-4321');

  simularMeta(t, erroDaMeta(131026));
  const recusado = await request(app).post('/notificacoes/whatsapp/teste').set(ana.auth).expect(409);
  assert.equal(recusado.body.erro.codigo, 'WHATSAPP_RECUSOU');
  assert.equal(recusado.body.erro.mensagem, 'Este número não recebe mensagens do WhatsApp.');

  t.mock.restoreAll();
  simularMeta(t, erroDaMeta(2, 500));
  const fora = await request(app).post('/notificacoes/whatsapp/teste').set(ana.auth).expect(502);
  assert.equal(fora.body.erro.codigo, 'WHATSAPP_FALHOU');

  t.mock.method(whatsapp, 'ativo', () => false);
  const desligado = await request(app).post('/notificacoes/whatsapp/teste').set(ana.auth).expect(503);
  assert.equal(desligado.body.erro.codigo, 'WHATSAPP_DESLIGADO');
  assert.equal((await request(app).get('/notificacoes/whatsapp').set(ana.auth)).body.disponivel, false);
});

test('lembrete pelo WhatsApp: só para quem tem número, com o texto em uma linha', async (t) => {
  await salvar(ana, '(11) 98765-4321');
  await salvar(bia, null);
  const evento = (sessao) =>
    request(app)
      .post('/eventos')
      .set(sessao.auth)
      .send({
        titulo: 'Cardiologista',
        tipo: 'consulta',
        inicio: '2026-12-15T14:00:00-03:00',
        local: 'Clínica\nBoa   Saúde',
        lembretesMinutosAntes: [120],
      })
      .expect(201);
  const { body: daAna } = await evento(ana);
  const { body: daBia } = await evento(bia);

  await gerar(em('2026-12-15T08:00'), { canais: [whatsapp] });
  assert.equal((await db('lembreteEnvio').where({ origemId: daBia.id })).length, 0);

  const chamadas = simularMeta(t);
  await enviarPendentes(em('2026-12-15T12:00'), { canais: [whatsapp] });
  assert.equal(chamadas.length, 1);
  const [titulo, detalhe] = chamadas[0].corpo.template.components[0].parameters.map((p) => p.text);
  assert.match(titulo, /Cardiologista/);
  assert.doesNotMatch(detalhe, /\n| {2,}/);
  const lembrete = await db('lembreteEnvio').where({ origemId: daAna.id }).first();
  assert.equal(lembrete.canal, 'whatsapp');
  assert.equal(lembrete.status, 'enviado');
});

test('falha da Meta tenta de novo; número sem WhatsApp cancela; tirar o número cancela os pendentes', async (t) => {
  await salvar(ana, '(11) 98765-4321');
  const criar = (inicio) =>
    request(app)
      .post('/eventos')
      .set(ana.auth)
      .send({ titulo: 'Exame', tipo: 'exame', inicio, local: 'Laboratório', lembretesMinutosAntes: [60] })
      .expect(201)
      .then((r) => r.body);
  const primeiro = await criar('2026-12-22T10:00:00-03:00');
  const segundo = await criar('2026-12-22T11:00:00-03:00');
  const terceiro = await criar('2026-12-22T15:00:00-03:00');
  await gerar(em('2026-12-22T08:00'), { canais: [whatsapp] });
  const doEvento = (e) => db('lembreteEnvio').where({ origemId: e.id }).first('status', 'tentativas', 'erro');

  simularMeta(t, erroDaMeta(1, 500));
  await enviarPendentes(em('2026-12-22T09:00'), { canais: [whatsapp] });
  assert.deepEqual(await doEvento(primeiro), { status: 'pendente', tentativas: 1, erro: 'WhatsApp respondeu 500: Erro 1' });

  t.mock.restoreAll();
  simularMeta(t, erroDaMeta(131026));
  await enviarPendentes(em('2026-12-22T10:00'), { canais: [whatsapp] });
  const cancelado = await doEvento(segundo);
  assert.equal(cancelado.status, 'cancelado');
  assert.equal(cancelado.erro, 'Este número não recebe mensagens do WhatsApp.');

  await salvar(ana, null);
  const removido = await doEvento(terceiro);
  assert.equal(removido.status, 'cancelado');
  assert.equal(removido.erro, 'Número de WhatsApp removido.');
});

test('o banco recusa número fora do formato', async () => {
  await assert.rejects(db('usuario').where({ id: ana.usuario.id }).update({ whatsapp: '(11) 9999' }), /usuario_whatsapp_check/);
});
