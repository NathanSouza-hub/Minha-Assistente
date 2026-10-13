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
  await criar({ descricao: 'Consulta', categoriaId: categorias.Consultas, valorCentavos: 45000, vencimento: '2026-10-15', status: 'pago', dataPagamento: '2026-10-15' });
  // Venceu em setembro mas foi pago em outubro: conta como pago em outubro.
  await criar({ descricao: 'Gás', categoriaId: contas, imovelId: cobertura.id, valorCentavos: 3000, vencimento: '2026-09-28', status: 'pago', dataPagamento: '2026-10-02' });
  // Fora do período
  await criar({ descricao: 'Luz nov', categoriaId: contas, imovelId: cobertura.id, valorCentavos: 99999, vencimento: '2026-11-05' });

  // Outro usuário no mesmo período não entra.
  const outra = await criarSessao(app);
  await request(app)
    .post('/pagamentos')
    .set(outra.auth)
    .send({ descricao: 'Alheio', categoriaId: contas, valorCentavos: 77777, vencimento: '2026-10-10' })
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
    { id: categorias.Consultas, nome: 'Consultas', pagoCentavos: 45000, previstoCentavos: 0 },
    { id: categorias['Contas residenciais'], nome: 'Contas residenciais', pagoCentavos: 23000, previstoCentavos: 8000 },
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
