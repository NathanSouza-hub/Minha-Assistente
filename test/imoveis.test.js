require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { CATEGORIAS_PADRAO } = require('../src/modules/categorias/padrao');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

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

test('rotas de imóveis e categorias exigem token', async () => {
  await request(app).get('/imoveis').expect(401);
  await request(app).get('/categorias-pagamento').expect(401);
});

test('GET /categorias-pagamento lista as categorias padrão em ordem', async () => {
  const res = await request(app).get('/categorias-pagamento').set(ana.auth).expect(200);
  assert.deepEqual(
    res.body.map((c) => c.nome),
    CATEGORIAS_PADRAO,
  );
});

test('CRUD de imóveis do próprio usuário', async () => {
  const criado = await request(app)
    .post('/imoveis')
    .set(ana.auth)
    .send({ nome: ' Casa da Serra ', ordem: 2 })
    .expect(201);
  assert.deepEqual(Object.keys(criado.body).sort(), ['complemento', 'endereco', 'id', 'nome', 'ordem']);
  assert.equal(criado.body.nome, 'Casa da Serra');

  await request(app).post('/imoveis').set(ana.auth).send({ nome: 'Apartamento cobertura', ordem: 1 }).expect(201);

  const lista = await request(app).get('/imoveis').set(ana.auth).expect(200);
  assert.deepEqual(lista.body.map((i) => i.nome), ['Apartamento cobertura', 'Casa da Serra']);

  const editado = await request(app)
    .put(`/imoveis/${criado.body.id}`)
    .set(ana.auth)
    .send({ nome: 'Casa da Serra (sítio)' })
    .expect(200);
  assert.equal(editado.body.nome, 'Casa da Serra (sítio)');
  assert.equal(editado.body.ordem, 2, 'ordem omitida no PUT não muda');

  await request(app).delete(`/imoveis/${criado.body.id}`).set(ana.auth).expect(204);
  await request(app).delete(`/imoveis/${criado.body.id}`).set(ana.auth).expect(404);
});

test('nome de imóvel repetido no mesmo usuário devolve 409; em outro usuário pode', async () => {
  await request(app).post('/imoveis').set(ana.auth).send({ nome: 'Praia' }).expect(201);
  const res = await request(app).post('/imoveis').set(ana.auth).send({ nome: 'Praia' }).expect(409);
  assert.equal(res.body.erro.codigo, 'IMOVEL_DUPLICADO');
  await request(app).post('/imoveis').set(bia.auth).send({ nome: 'Praia' }).expect(201);
});

test('usuário não vê, edita nem apaga imóvel de outro (404)', async () => {
  const { body: imovel } = await request(app).post('/imoveis').set(ana.auth).send({ nome: 'Só da Ana' }).expect(201);

  const daBia = await request(app).get('/imoveis').set(bia.auth).expect(200);
  assert.ok(!daBia.body.some((i) => i.id === imovel.id));

  await request(app).put(`/imoveis/${imovel.id}`).set(bia.auth).send({ nome: 'Invadido' }).expect(404);
  await request(app).delete(`/imoveis/${imovel.id}`).set(bia.auth).expect(404);
});

test('não apaga imóvel com pagamentos ligados (409 REFERENCIA_INVALIDA)', async () => {
  const { body: imovel } = await request(app).post('/imoveis').set(ana.auth).send({ nome: 'Com contas' }).expect(201);
  const [categoria] = (await request(app).get('/categorias-pagamento').set(ana.auth)).body;
  await request(app)
    .post('/pagamentos')
    .set(ana.auth)
    .send({ descricao: 'IPTU', categoriaId: categoria.id, imovelId: imovel.id, valorCentavos: 5000, vencimento: '2026-11-10' })
    .expect(201);

  const res = await request(app).delete(`/imoveis/${imovel.id}`).set(ana.auth).expect(409);
  assert.equal(res.body.erro.codigo, 'REFERENCIA_INVALIDA');
});

test('id malformado devolve 400', async () => {
  const res = await request(app).put('/imoveis/123').set(ana.auth).send({ nome: 'X' }).expect(400);
  assert.match(res.body.erro.mensagem, /id: ID inválido/);
});

test('endereço e complemento: opcionais, editáveis e mantidos no PUT que não os envia', async () => {
  const criado = (
    await request(app)
      .post('/imoveis')
      .set(ana.auth)
      .send({ nome: 'Sala comercial', endereco: '  Av. Paulista, 1000  ', complemento: 'Conj. 52' })
      .expect(201)
  ).body;
  assert.equal(criado.endereco, 'Av. Paulista, 1000');
  assert.equal(criado.complemento, 'Conj. 52');

  // Quem só renomeia (ex.: a versão antiga do app) não apaga o endereço.
  const renomeado = (await request(app).put(`/imoveis/${criado.id}`).set(ana.auth).send({ nome: 'Sala 52' }).expect(200)).body;
  assert.equal(renomeado.endereco, 'Av. Paulista, 1000');
  assert.equal(renomeado.complemento, 'Conj. 52');

  // Vazio apaga.
  const limpo = (
    await request(app).put(`/imoveis/${criado.id}`).set(ana.auth).send({ nome: 'Sala 52', endereco: '', complemento: null }).expect(200)
  ).body;
  assert.equal(limpo.endereco, null);
  assert.equal(limpo.complemento, null);

  const sem = (await request(app).post('/imoveis').set(ana.auth).send({ nome: 'Terreno' }).expect(201)).body;
  assert.equal(sem.endereco, null);

  assert.equal((await request(app).get(`/imoveis/${criado.id}`).set(ana.auth).expect(200)).body.nome, 'Sala 52');
  await request(app).get(`/imoveis/${criado.id}`).set(bia.auth).expect(404);
});

test('resumo do imóvel: só as contas dele no período, por categoria e mês a mês', async () => {
  const carla = await criarSessao(app);
  const [contas, outros] = (await request(app).get('/categorias-pagamento').set(carla.auth)).body;
  const casa = (await request(app).post('/imoveis').set(carla.auth).send({ nome: 'Casa' })).body;
  const sitio = (await request(app).post('/imoveis').set(carla.auth).send({ nome: 'Sítio' })).body;
  const criar = (dados) => request(app).post('/pagamentos').set(carla.auth).send(dados).expect(201);
  await criar({ descricao: 'Luz jan', categoriaId: contas.id, imovelId: casa.id, valorCentavos: 10000, vencimento: '2020-01-10', status: 'pago', dataPagamento: '2020-01-10' });
  await criar({ descricao: 'Água fev', categoriaId: contas.id, imovelId: casa.id, valorCentavos: 4000, vencimento: '2020-02-10' });
  await criar({ descricao: 'Jardim fev', categoriaId: outros.id, imovelId: casa.id, valorCentavos: 6000, vencimento: '2020-02-15' });
  await criar({ descricao: 'Do sítio', categoriaId: contas.id, imovelId: sitio.id, valorCentavos: 99900, vencimento: '2020-02-10' });
  await criar({ descricao: 'Pessoal', categoriaId: outros.id, valorCentavos: 88800, vencimento: '2020-02-10' });

  const r = (
    await request(app).get(`/relatorios/imoveis/${casa.id}`).query({ inicio: '2020-01-01', fim: '2020-03-31' }).set(carla.auth).expect(200)
  ).body;
  assert.equal(r.imovel.nome, 'Casa');
  assert.equal(r.totalCentavos, 20000);
  assert.equal(r.pagoCentavos, 10000);
  assert.equal(r.pendenteCentavos, 10000);
  assert.equal(r.vencidoCentavos, 10000);
  assert.equal(r.totalComprovantes, 0);
  assert.deepEqual(r.categorias, [
    { id: contas.id, nome: contas.nome, totalCentavos: 14000, pagoCentavos: 10000 },
    { id: outros.id, nome: outros.nome, totalCentavos: 6000, pagoCentavos: 0 },
  ]);
  assert.deepEqual(r.meses, [
    { mes: '2020-01', totalCentavos: 10000, pagoCentavos: 10000 },
    { mes: '2020-02', totalCentavos: 10000, pagoCentavos: 0 },
    { mes: '2020-03', totalCentavos: 0, pagoCentavos: 0 },
  ]);

  await request(app).get(`/relatorios/imoveis/${casa.id}`).query({ inicio: '2020-01-01', fim: '2020-03-31' }).set(ana.auth).expect(404);
  await request(app).get(`/relatorios/imoveis/${casa.id}`).set(carla.auth).expect(400);
});
