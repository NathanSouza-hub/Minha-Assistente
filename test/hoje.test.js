require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { hoje } = require('../src/lib/tempo');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

// Dia do painel nos testes: 2026-10-19 (segunda, diaSemana 1).
const DIA = '2026-10-19';

let app;
let sessao;

const post = (rota, corpo) => request(app).post(rota).set(sessao.auth).send(corpo).expect(201);

const painel = async (sessaoAtual, query = { data: DIA }) =>
  (await request(app).get('/hoje').query(query).set(sessaoAtual.auth).expect(200)).body;

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  sessao = await criarSessao(app);

  // Agenda: um evento no dia, um recorrente semanal que cai no dia, um em outro dia.
  await post('/eventos', { titulo: 'Consulta', tipo: 'consulta', inicio: `${DIA}T10:00:00-03:00` });
  await post('/eventos', {
    titulo: 'Programa de rádio',
    tipo: 'programa_radio',
    inicio: '2026-10-05T07:00:00-03:00',
    recorrencia: 'semanal',
  });
  await post('/eventos', { titulo: 'Amanhã', tipo: 'exame', inicio: '2026-10-20T08:00:00-03:00' });

  // Remédios: um diário e um semanal de segunda.
  const { body: remedio } = await post('/medicamentos', {
    nome: 'Losartana',
    horarios: [
      { periodo: 'manha', hora: '08:00' },
      { periodo: 'semanal', hora: '09:00', diaSemana: 1 },
    ],
  });
  await request(app)
    .post('/medicamentos/registros')
    .set(sessao.auth)
    .send({ horarioId: remedio.horarios[0].id, data: DIA })
    .expect(200);

  // Rotina: uma concluída, uma pendente, uma só aos domingos.
  const { body: emails } = await post('/rotinas', { titulo: 'Ler e-mails', ordem: 1 });
  await post('/rotinas', { titulo: 'Enviar mensagens', ordem: 2 });
  await post('/rotinas', { titulo: 'Só domingo', diasSemana: [0] });
  await request(app).post(`/rotinas/${emails.id}/concluir`).set(sessao.auth).send({ data: DIA }).expect(200);

  // Pagamentos
  const categorias = (await request(app).get('/categorias-pagamento').set(sessao.auth)).body;
  const categoriaId = categorias[0].id;
  const pagamento = (descricao, vencimento, extra = {}) =>
    post('/pagamentos', { descricao, categoriaId, valorCentavos: 10000, vencimento, ...extra });
  await pagamento('Vencido', '2026-10-10');
  await pagamento('Vence hoje', DIA);
  await pagamento('Vence em 7 dias', '2026-10-26');
  await pagamento('Vence em 8 dias', '2026-10-27');
  await pagamento('Já pago', '2026-10-15', { status: 'pago', dataPagamento: '2026-10-15' });
});

after(async () => {
  await db.destroy();
});

test('painel junta agenda, remédios, rotina e pagamentos do dia', async () => {
  const p = await painel(sessao);
  assert.equal(p.data, DIA);

  assert.deepEqual(p.eventos.map((e) => e.titulo), ['Programa de rádio', 'Consulta']);
  assert.equal(p.eventos[0].inicio, `${DIA}T07:00:00-03:00`);

  assert.deepEqual(
    p.medicamentos.map((m) => [m.periodo, m.tomado]),
    [
      ['manha', true],
      ['semanal', false],
    ],
  );
  assert.deepEqual(
    p.rotina.map((t) => [t.titulo, t.concluida]),
    [
      ['Ler e-mails', true],
      ['Enviar mensagens', false],
    ],
  );

  assert.deepEqual(p.pagamentos.vencidos.map((x) => x.descricao), ['Vencido']);
  assert.deepEqual(p.pagamentos.aVencer.map((x) => x.descricao), ['Vence hoje', 'Vence em 7 dias']);
  assert.equal(p.pagamentos.totalVencidoCentavos, 10000);
  assert.equal(p.pagamentos.totalAVencerCentavos, 20000);

  assert.deepEqual(p.resumo, {
    eventos: 2,
    remediosPendentes: 1,
    tarefasPendentes: 1,
    pagamentosVencidos: 1,
    pagamentosAVencer: 2,
  });
});

test('sem data usa hoje; usuário novo recebe painel vazio', async () => {
  const novo = await criarSessao(app);
  const p = await painel(novo, {});
  assert.equal(p.data, hoje());
  assert.deepEqual(p.eventos, []);
  assert.deepEqual(p.medicamentos, []);
  assert.deepEqual(p.rotina, []);
  assert.deepEqual(p.pagamentos, { vencidos: [], aVencer: [], totalVencidoCentavos: 0, totalAVencerCentavos: 0 });
});

test('data inválida devolve 400 e sem token 401', async () => {
  await request(app).get('/hoje').query({ data: '2026-02-30' }).set(sessao.auth).expect(400);
  await request(app).get('/hoje').expect(401);
});
