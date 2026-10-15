require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { hoje } = require('../src/lib/tempo');
const { primeiraCompetencia, datasDaCompetencia } = require('../src/lib/fatura');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;
let ana;
let bia;

// Fecha dia 3, vence dia 10. Datas no ano 2999 para nenhuma fatura ficar "fechada" por acaso.
const dadosCartao = (extra = {}) => ({ nome: 'Nubank', final: '1234', cor: 'roxo', diaFechamento: 3, diaVencimento: 10, ...extra });

const criarCartao = async (sessao, extra = {}, status = 201) =>
  (await request(app).post('/cartoes').set(sessao.auth).send(dadosCartao(extra)).expect(status)).body;

const comprar = async (sessao, cartaoId, dados, status = 201) =>
  (
    await request(app)
      .post(`/cartoes/${cartaoId}/compras`)
      .set(sessao.auth)
      .send({ descricao: 'Mercado', valorTotalCentavos: 10000, dataCompra: '2999-01-20', ...dados })
      .expect(status)
  ).body;

const faturas = async (sessao, cartaoId) =>
  (await request(app).get('/pagamentos').set(sessao.auth).expect(200)).body
    .filter((p) => p.cartaoId === cartaoId)
    .map(({ competencia, valorCentavos, vencimento, status }) => ({ competencia, valorCentavos, vencimento, status }));

const fatura = async (sessao, cartaoId, competencia, status = 200) =>
  (await request(app).get(`/cartoes/${cartaoId}/faturas/${competencia}`).set(sessao.auth).expect(status)).body;

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

test('cria, lista, busca e edita cartão; nome repetido é 409', async () => {
  const cartao = await criarCartao(ana, { nome: 'Itaú', limiteCentavos: 500000 });
  assert.equal(cartao.nome, 'Itaú');
  assert.equal(cartao.final, '1234');
  assert.equal(cartao.cor, 'roxo');
  assert.equal(cartao.diaFechamento, 3);
  assert.equal(cartao.limiteCentavos, 500000);
  assert.equal(cartao.limiteDisponivelCentavos, 500000);
  assert.equal(cartao.faturaAtual.totalCentavos, 0);
  assert.equal('usuarioId' in cartao, false);

  const repetido = await criarCartao(ana, { nome: 'itaú' }, 409);
  assert.equal(repetido.erro.codigo, 'CARTAO_DUPLICADO');

  const { body: editado } = await request(app)
    .put(`/cartoes/${cartao.id}`)
    .set(ana.auth)
    .send(dadosCartao({ nome: 'Itaú Black', cor: 'grafite', final: null }))
    .expect(200);
  assert.equal(editado.nome, 'Itaú Black');
  assert.equal(editado.final, null);
  assert.equal(editado.limiteCentavos, null);
  assert.equal(editado.limiteDisponivelCentavos, null);

  const { body: lista } = await request(app).get('/cartoes').set(ana.auth).expect(200);
  assert.ok(lista.some((c) => c.id === cartao.id));
  await request(app).get(`/cartoes/${cartao.id}`).set(ana.auth).expect(200);
});

test('valida os campos do cartão', async () => {
  const final = await criarCartao(ana, { nome: 'X', final: '12a4' }, 400);
  assert.match(final.erro.mensagem, /final/);
  const dia = await criarCartao(ana, { nome: 'Y', diaFechamento: 32 }, 400);
  assert.match(dia.erro.mensagem, /diaFechamento/);
  const cor = await criarCartao(ana, { nome: 'Z', cor: 'rosa' }, 400);
  assert.match(cor.erro.mensagem, /cor/);
});

test('cartão e compras de outro usuário respondem 404', async () => {
  const cartao = await criarCartao(ana, { nome: 'Só da Ana' });
  const compra = await comprar(ana, cartao.id, {});
  await request(app).get(`/cartoes/${cartao.id}`).set(bia.auth).expect(404);
  await request(app).put(`/cartoes/${cartao.id}`).set(bia.auth).send(dadosCartao()).expect(404);
  await request(app).delete(`/cartoes/${cartao.id}`).set(bia.auth).expect(404);
  await comprar(bia, cartao.id, {}, 404);
  await request(app).get(`/cartoes/${cartao.id}/faturas/2999-02`).set(bia.auth).expect(404);
  await request(app)
    .put(`/cartoes/${cartao.id}/compras/${compra.id}`)
    .set(bia.auth)
    .send({ descricao: 'x', valorTotalCentavos: 1, dataCompra: '2999-01-20' })
    .expect(404);
  await request(app).delete(`/cartoes/${cartao.id}/compras/${compra.id}`).set(bia.auth).expect(404);
  await request(app).get(`/cartoes/${cartao.id}/compras/${compra.id}`).set(bia.auth).expect(404);
  const { body } = await request(app).get('/cartoes').set(bia.auth).expect(200);
  assert.equal(body.length, 0);
});

test('compra não aceita categoria de outro usuário', async () => {
  const cartao = await criarCartao(ana, { nome: 'Categorias' });
  const [categoriaBia] = (await request(app).get('/categorias-pagamento').set(bia.auth)).body;
  const erro = await comprar(ana, cartao.id, { categoriaId: categoriaBia.id }, 400);
  assert.match(erro.erro.mensagem, /categoriaId/);
});

test('compra à vista cria a conta da fatura em /pagamentos', async () => {
  const cartao = await criarCartao(ana, { nome: 'À vista' });
  const compra = await comprar(ana, cartao.id, { valorTotalCentavos: 12345 });
  assert.equal(compra.parcelas, 1);
  assert.deepEqual(compra.competencias, ['2999-02-01']);
  const { body: lida } = await request(app).get(`/cartoes/${cartao.id}/compras/${compra.id}`).set(ana.auth).expect(200);
  assert.deepEqual(lida, compra);

  const { body } = await request(app).get('/pagamentos').set(ana.auth).expect(200);
  const conta = body.find((p) => p.cartaoId === cartao.id);
  assert.equal(conta.descricao, 'Fatura À vista');
  assert.equal(conta.cartaoNome, 'À vista');
  assert.equal(conta.competencia, '2999-02-01');
  assert.equal(conta.vencimento, '2999-02-10');
  assert.equal(conta.valorCentavos, 12345);
  assert.equal(conta.status, 'pendente');
  assert.equal(conta.categoriaId, null);
  assert.equal(conta.categoriaNome, null);
});

test('parcelada espalha nas competências e soma com outras compras', async () => {
  const cartao = await criarCartao(ana, { nome: 'Parcelas' });
  await comprar(ana, cartao.id, { valorTotalCentavos: 1000, parcelas: 3 });
  await comprar(ana, cartao.id, { valorTotalCentavos: 500, dataCompra: '2999-02-02' });
  assert.deepEqual(await faturas(ana, cartao.id), [
    { competencia: '2999-02-01', valorCentavos: 834, vencimento: '2999-02-10', status: 'pendente' },
    { competencia: '2999-03-01', valorCentavos: 333, vencimento: '2999-03-10', status: 'pendente' },
    { competencia: '2999-04-01', valorCentavos: 333, vencimento: '2999-04-10', status: 'pendente' },
  ]);
});

test('editar e apagar compra recalcula; fatura zerada some', async () => {
  const cartao = await criarCartao(ana, { nome: 'Edições' });
  const compra = await comprar(ana, cartao.id, { valorTotalCentavos: 1000, parcelas: 2 });

  const { body: editada } = await request(app)
    .put(`/cartoes/${cartao.id}/compras/${compra.id}`)
    .set(ana.auth)
    .send({ descricao: 'Mercado', valorTotalCentavos: 900, parcelas: 1, dataCompra: '2999-03-05' })
    .expect(200);
  assert.deepEqual(editada.competencias, ['2999-04-01']);
  assert.deepEqual(await faturas(ana, cartao.id), [
    { competencia: '2999-04-01', valorCentavos: 900, vencimento: '2999-04-10', status: 'pendente' },
  ]);

  await request(app).delete(`/cartoes/${cartao.id}/compras/${compra.id}`).set(ana.auth).expect(204);
  assert.deepEqual(await faturas(ana, cartao.id), []);
});

test('fatura paga não aceita mudança: 409 FATURA_PAGA', async () => {
  const cartao = await criarCartao(ana, { nome: 'Paga' });
  const compra = await comprar(ana, cartao.id, {});
  const conta = (await request(app).get('/pagamentos').set(ana.auth)).body.find((p) => p.cartaoId === cartao.id);
  await request(app).patch(`/pagamentos/${conta.id}/pagar`).set(ana.auth).send({}).expect(200);

  const nova = await comprar(ana, cartao.id, { dataCompra: '2999-01-25' }, 409);
  assert.equal(nova.erro.codigo, 'FATURA_PAGA');
  assert.match(nova.erro.mensagem, /fevereiro de 2999/);
  await request(app).delete(`/cartoes/${cartao.id}/compras/${compra.id}`).set(ana.auth).expect(409);

  // Compra na fatura seguinte continua valendo.
  await comprar(ana, cartao.id, { dataCompra: '2999-02-05' });

  const mudarDias = await request(app)
    .put(`/cartoes/${cartao.id}`)
    .set(ana.auth)
    // Fechando dia 19, a compra de 20/jan sairia da fatura paga de fevereiro.
    .send(dadosCartao({ nome: 'Paga', diaFechamento: 19 }))
    .expect(409);
  assert.equal(mudarDias.body.erro.codigo, 'FATURA_PAGA');

  const apagar = await request(app).delete(`/cartoes/${cartao.id}`).set(ana.auth).expect(409);
  assert.equal(apagar.body.erro.codigo, 'REFERENCIA_INVALIDA');
});

test('mudar os dias do cartão reprocessa as faturas pendentes', async () => {
  const cartao = await criarCartao(ana, { nome: 'Dias' });
  await comprar(ana, cartao.id, { dataCompra: '2999-01-20' });
  await request(app)
    .put(`/cartoes/${cartao.id}`)
    .set(ana.auth)
    .send(dadosCartao({ nome: 'Dias', diaFechamento: 25, diaVencimento: 5 }))
    .expect(200);
  // Fecha dia 25: a compra de 20/jan entra na fatura que fecha em 25/jan e vence em 05/fev.
  assert.deepEqual(await faturas(ana, cartao.id), [
    { competencia: '2999-02-01', valorCentavos: 10000, vencimento: '2999-02-05', status: 'pendente' },
  ]);

  await request(app)
    .put(`/cartoes/${cartao.id}`)
    .set(ana.auth)
    .send(dadosCartao({ nome: 'Dias', diaFechamento: 15, diaVencimento: 22 }))
    .expect(200);
  assert.deepEqual(await faturas(ana, cartao.id), [
    { competencia: '2999-02-01', valorCentavos: 10000, vencimento: '2999-02-22', status: 'pendente' },
  ]);
});

test('fatura do mês com parcelas e selo; mês sem compras vem zerado', async () => {
  const cartao = await criarCartao(ana, { nome: 'Fatura' });
  const [categoria] = (await request(app).get('/categorias-pagamento').set(ana.auth)).body;
  const geladeira = await comprar(ana, cartao.id, {
    descricao: 'Geladeira',
    valorTotalCentavos: 300000,
    parcelas: 10,
    dataCompra: '2998-11-10',
    categoriaId: categoria.id,
  });
  await comprar(ana, cartao.id, { descricao: 'Padaria', valorTotalCentavos: 1500, dataCompra: '2999-01-20' });

  const f = await fatura(ana, cartao.id, '2999-02');
  assert.equal(f.competencia, '2999-02-01');
  assert.equal(f.fechamento, '2999-02-03');
  assert.equal(f.vencimento, '2999-02-10');
  assert.equal(f.situacao, 'aberta');
  assert.equal(f.totalCentavos, 31500);
  assert.ok(f.pagamentoId);
  assert.deepEqual(
    f.parcelas.map((p) => [p.descricao, p.parcela, p.totalParcelas, p.valorCentavos]),
    [
      ['Geladeira', 3, 10, 30000],
      ['Padaria', 1, 1, 1500],
    ],
  );
  assert.equal(f.parcelas[0].compraId, geladeira.id);
  assert.equal(f.parcelas[0].categoriaNome, categoria.nome);
  assert.equal(f.parcelas[1].categoriaNome, null);

  const vazia = await fatura(ana, cartao.id, '2990-05');
  assert.equal(vazia.totalCentavos, 0);
  assert.equal(vazia.pagamentoId, null);
  assert.deepEqual(vazia.parcelas, []);

  await fatura(ana, cartao.id, '2999-13', 400);
});

test('limite disponível desconta as parcelas de faturas não pagas', async () => {
  const cartao = await criarCartao(ana, { nome: 'Limite', limiteCentavos: 100000 });
  await comprar(ana, cartao.id, { valorTotalCentavos: 30000, parcelas: 3 });
  const buscar = async () => (await request(app).get(`/cartoes/${cartao.id}`).set(ana.auth).expect(200)).body;
  assert.equal((await buscar()).limiteDisponivelCentavos, 70000);

  const conta = (await request(app).get('/pagamentos').set(ana.auth)).body.find(
    (p) => p.cartaoId === cartao.id && p.competencia === '2999-02-01',
  );
  await request(app).patch(`/pagamentos/${conta.id}/pagar`).set(ana.auth).send({}).expect(200);
  assert.equal((await buscar()).limiteDisponivelCentavos, 80000);
});

test('fatura atual: a que recebe as compras de hoje quando não há outra pendente', async () => {
  const cartao = await criarCartao(ana, { nome: 'Atual' });
  const competencia = primeiraCompetencia(cartao, hoje());
  assert.deepEqual(cartao.faturaAtual, {
    competencia,
    totalCentavos: 0,
    vencimento: datasDaCompetencia(cartao, competencia).vencimento,
    situacao: 'aberta',
  });

  await comprar(ana, cartao.id, { valorTotalCentavos: 777, dataCompra: hoje() });
  const { body } = await request(app).get(`/cartoes/${cartao.id}`).set(ana.auth).expect(200);
  assert.equal(body.faturaAtual.competencia, competencia);
  assert.equal(body.faturaAtual.totalCentavos, 777);
});

test('fatura em /pagamentos: não edita nem apaga, mas paga', async () => {
  const cartao = await criarCartao(ana, { nome: 'Automática' });
  await comprar(ana, cartao.id, {});
  const conta = (await request(app).get('/pagamentos').set(ana.auth)).body.find((p) => p.cartaoId === cartao.id);

  const categorias = (await request(app).get('/categorias-pagamento').set(ana.auth)).body;
  const editar = await request(app)
    .put(`/pagamentos/${conta.id}`)
    .set(ana.auth)
    .send({ descricao: 'x', categoriaId: categorias[0].id, valorCentavos: 1, vencimento: '2999-01-01' })
    .expect(409);
  assert.equal(editar.body.erro.codigo, 'FATURA_AUTOMATICA');
  const apagar = await request(app).delete(`/pagamentos/${conta.id}`).set(ana.auth).expect(409);
  assert.equal(apagar.body.erro.codigo, 'FATURA_AUTOMATICA');

  const { body: paga } = await request(app).patch(`/pagamentos/${conta.id}/pagar`).set(ana.auth).send({}).expect(200);
  assert.equal(paga.status, 'pago');
  assert.equal(paga.cartaoNome, 'Automática');
});

test('relatório por categoria junta as faturas em "Cartão de crédito"', async () => {
  const sessao = await criarSessao(app);
  const cartao = await criarCartao(sessao, { nome: 'Relatório' });
  await comprar(sessao, cartao.id, { valorTotalCentavos: 4000 });
  const { body } = await request(app)
    .get('/relatorios/gastos')
    .query({ inicio: '2999-02-01', fim: '2999-02-28', agruparPor: 'categoria' })
    .set(sessao.auth)
    .expect(200);
  assert.deepEqual(body.itens, [{ id: null, nome: 'Cartão de crédito', pagoCentavos: 0, previstoCentavos: 4000 }]);
});

test('apagar cartão sem fatura paga leva compras e faturas pendentes', async () => {
  const cartao = await criarCartao(ana, { nome: 'Apagar' });
  await comprar(ana, cartao.id, { parcelas: 2 });
  await request(app).delete(`/cartoes/${cartao.id}`).set(ana.auth).expect(204);
  assert.deepEqual(await faturas(ana, cartao.id), []);
  await request(app).get(`/cartoes/${cartao.id}`).set(ana.auth).expect(404);
});
