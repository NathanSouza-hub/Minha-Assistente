require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
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

test('GET /categorias-pagamento lista as 7 categorias em ordem', async () => {
  const res = await request(app).get('/categorias-pagamento').set(ana.auth).expect(200);
  assert.deepEqual(
    res.body.map((c) => c.nome),
    ['Salários', 'Honorários médicos', 'Consultas', 'Exames', 'Parcelamentos', 'Contas residenciais', 'Outros'],
  );
});

test('CRUD de imóveis do próprio usuário', async () => {
  const criado = await request(app)
    .post('/imoveis')
    .set(ana.auth)
    .send({ nome: ' Casa da Serra ', ordem: 2 })
    .expect(201);
  assert.deepEqual(Object.keys(criado.body).sort(), ['id', 'nome', 'ordem']);
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
