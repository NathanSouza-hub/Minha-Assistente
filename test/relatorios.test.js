require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;
let sessao;
let categorias;
let cobertura;
let serra;

const criar = (dados) => request(app).post('/pagamentos').set(sessao.auth).send(dados).expect(201);

const relatorio = async (query, status = 200) =>
  (await request(app).get('/relatorios/gastos').query(query).set(sessao.auth).expect(status)).body;

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  sessao = await criarSessao(app);
  const lista = (await request(app).get('/categorias-pagamento').set(sessao.auth)).body;
  categorias = Object.fromEntries(lista.map((c) => [c.nome, c.id]));
  cobertura = (await request(app).post('/imoveis').set(sessao.auth).send({ nome: 'Cobertura', ordem: 1 })).body;
  serra = (await request(app).post('/imoveis').set(sessao.auth).send({ nome: 'Serra', ordem: 2 })).body;

  const contas = categorias['Contas residenciais'];
  // Dentro de outubro/2026
  await criar({ descricao: 'Luz', categoriaId: contas, imovelId: cobertura.id, valorCentavos: 20000, vencimento: '2026-10-05', status: 'pago', dataPagamento: '2026-10-04' });
  await criar({ descricao: 'Água', categoriaId: contas, imovelId: serra.id, valorCentavos: 8000, vencimento: '2026-10-20' });
  await criar({ descricao: 'Consulta', categoriaId: categorias.Outros, valorCentavos: 45000, vencimento: '2026-10-15', status: 'pago', dataPagamento: '2026-10-15' });
  // Venceu em setembro mas foi pago em outubro: conta como pago em outubro.
  await criar({ descricao: 'Gás', categoriaId: contas, imovelId: cobertura.id, valorCentavos: 3000, vencimento: '2026-09-28', status: 'pago', dataPagamento: '2026-10-02' });
  // Fora do período
  await criar({ descricao: 'Luz nov', categoriaId: contas, imovelId: cobertura.id, valorCentavos: 99999, vencimento: '2026-11-05' });

  // Outro usuário no mesmo período não entra.
  const outra = await criarSessao(app);
  const [daOutra] = (await request(app).get('/categorias-pagamento').set(outra.auth)).body;
  await request(app)
    .post('/pagamentos')
    .set(outra.auth)
    .send({ descricao: 'Alheio', categoriaId: daOutra.id, valorCentavos: 77777, vencimento: '2026-10-10' })
    .expect(201);
});

after(async () => {
  await db.destroy();
});

test('agrupado por imóvel: pago, previsto e "Sem imóvel"', async () => {
  const r = await relatorio({ inicio: '2026-10-01', fim: '2026-10-31', agruparPor: 'imovel' });
  assert.deepEqual(r, {
    inicio: '2026-10-01',
    fim: '2026-10-31',
    agruparPor: 'imovel',
    totalPagoCentavos: 68000,
    totalPrevistoCentavos: 8000,
    itens: [
      { id: cobertura.id, nome: 'Cobertura', pagoCentavos: 23000, previstoCentavos: 0 },
      { id: serra.id, nome: 'Serra', pagoCentavos: 0, previstoCentavos: 8000 },
      { id: null, nome: 'Sem imóvel', pagoCentavos: 45000, previstoCentavos: 0 },
    ],
  });
});

test('agrupado por categoria, na ordem das categorias', async () => {
  const r = await relatorio({ inicio: '2026-10-01', fim: '2026-10-31', agruparPor: 'categoria' });
  assert.deepEqual(r.itens, [
    { id: categorias['Contas residenciais'], nome: 'Contas residenciais', pagoCentavos: 23000, previstoCentavos: 8000 },
    { id: categorias.Outros, nome: 'Outros', pagoCentavos: 45000, previstoCentavos: 0 },
  ]);
  assert.equal(r.totalPagoCentavos, 68000);
});

test('período sem movimento devolve totais zerados e lista vazia', async () => {
  const r = await relatorio({ inicio: '2020-01-01', fim: '2020-01-31', agruparPor: 'categoria' });
  assert.equal(r.totalPagoCentavos, 0);
  assert.equal(r.totalPrevistoCentavos, 0);
  assert.deepEqual(r.itens, []);
});

test('parâmetros obrigatórios e válidos', async () => {
  const semNada = await relatorio({}, 400);
  assert.equal(semNada.erro.codigo, 'VALIDACAO');
  const agrupamento = await relatorio({ inicio: '2026-10-01', fim: '2026-10-31', agruparPor: 'mes' }, 400);
  assert.match(agrupamento.erro.mensagem, /agruparPor/);
  await request(app).get('/relatorios/gastos').expect(401);
});

// ---- Visão financeira (/relatorios/financeiro) ----
// Datas fixas no passado (março/2020: toda pendente já venceu) e no futuro (2099: nenhuma venceu),
// para o "vencido" não depender do dia em que o teste roda.

const financeiro = async (query, status = 200) =>
  (await request(app).get('/relatorios/financeiro').query(query).set(sessao.auth).expect(status)).body;

test('financeiro: contas do período por situação, realizado, imóveis e pessoal', async () => {
  const contas = categorias['Contas residenciais'];
  await criar({ descricao: 'Luz mar', categoriaId: contas, imovelId: cobertura.id, valorCentavos: 10000, vencimento: '2020-03-05', status: 'pago', dataPagamento: '2020-03-04' });
  await criar({ descricao: 'Água mar', categoriaId: contas, imovelId: cobertura.id, valorCentavos: 5000, vencimento: '2020-03-10' });
  await criar({ descricao: 'Farmácia', categoriaId: categorias.Outros, valorCentavos: 7000, vencimento: '2020-03-12' });
  // Vence em março e foi paga em abril: pago entre as contas de março, realizado em abril.
  await criar({ descricao: 'Academia', categoriaId: categorias.Outros, valorCentavos: 3000, vencimento: '2020-03-20', status: 'pago', dataPagamento: '2020-04-02' });
  // Vence em fevereiro e foi paga em março: só no realizado de março.
  await criar({ descricao: 'Gás fev', categoriaId: contas, imovelId: cobertura.id, valorCentavos: 2000, vencimento: '2020-02-25', status: 'pago', dataPagamento: '2020-03-01' });

  const r = await financeiro({ inicio: '2020-03-01', fim: '2020-03-31' });
  assert.deepEqual(r, {
    inicio: '2020-03-01',
    fim: '2020-03-31',
    saidas: {
      totalCentavos: 25000,
      pagoCentavos: 13000,
      pendenteCentavos: 12000,
      vencidoCentavos: 12000,
      pagoNoPeriodoCentavos: 12000,
      contasADefinir: 0,
    },
    imoveis: [
      { id: cobertura.id, nome: 'Cobertura', totalCentavos: 15000, pagoCentavos: 10000, pendenteCentavos: 5000, vencidoCentavos: 5000 },
      { id: serra.id, nome: 'Serra', totalCentavos: 0, pagoCentavos: 0, pendenteCentavos: 0, vencidoCentavos: 0 },
    ],
    pessoal: {
      totalCentavos: 10000,
      pagoCentavos: 3000,
      pendenteCentavos: 7000,
      vencidoCentavos: 7000,
      categorias: [{ id: categorias.Outros, nome: 'Outros', totalCentavos: 10000 }],
    },
  });
  // Imóveis + pessoal = total: nenhum gasto contado duas vezes.
  const somaImoveis = r.imoveis.reduce((s, i) => s + i.totalCentavos, 0);
  assert.equal(somaImoveis + r.pessoal.totalCentavos, r.saidas.totalCentavos);

  const abril = await financeiro({ inicio: '2020-04-01', fim: '2020-04-30' });
  assert.equal(abril.saidas.totalCentavos, 0);
  assert.equal(abril.saidas.pagoNoPeriodoCentavos, 3000);
});

test('financeiro: pendente que ainda não venceu não conta como vencido', async () => {
  await criar({ descricao: 'Futuro', categoriaId: categorias.Outros, valorCentavos: 4000, vencimento: '2099-01-10' });
  const r = await financeiro({ inicio: '2099-01-01', fim: '2099-01-31' });
  assert.equal(r.saidas.pendenteCentavos, 4000);
  assert.equal(r.saidas.vencidoCentavos, 0);
  assert.equal(r.pessoal.vencidoCentavos, 0);
});

test('financeiro: só os dados do usuário; parâmetros obrigatórios', async () => {
  const outra = await criarSessao(app);
  const r = (
    await request(app).get('/relatorios/financeiro').query({ inicio: '2020-03-01', fim: '2020-03-31' }).set(outra.auth).expect(200)
  ).body;
  assert.equal(r.saidas.totalCentavos, 0);
  assert.deepEqual(r.imoveis, []);
  assert.deepEqual(r.pessoal.categorias, []);

  assert.equal((await financeiro({ inicio: '2020-03-01' }, 400)).erro.codigo, 'VALIDACAO');
  assert.equal((await financeiro({ inicio: '2020-03-31', fim: '2020-03-01' }, 400)).erro.codigo, 'VALIDACAO');
  await request(app).get('/relatorios/financeiro').expect(401);
});

test('listagem de pagamentos filtra pelo destino (pessoal = sem imóvel)', async () => {
  const lista = async (destino) =>
    (await request(app).get('/pagamentos').query({ inicio: '2020-03-01', fim: '2020-03-31', destino }).set(sessao.auth).expect(200)).body;
  assert.deepEqual((await lista('pessoal')).map((p) => p.descricao).sort(), ['Academia', 'Farmácia']);
  assert.deepEqual((await lista('imovel')).map((p) => p.descricao).sort(), ['Luz mar', 'Água mar']);
  await request(app).get('/pagamentos').query({ destino: 'outro' }).set(sessao.auth).expect(400);
});
