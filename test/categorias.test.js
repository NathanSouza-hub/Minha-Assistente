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

const listar = async (sessao) =>
  (await request(app).get('/categorias-pagamento').set(sessao.auth).expect(200)).body;

test('cadastro cria as categorias padrão, separadas por usuário', async () => {
  const daAna = await listar(ana);
  const daBia = await listar(bia);
  const padrao = CATEGORIAS_PADRAO;
  assert.deepEqual(daAna.map((c) => c.nome), padrao);
  assert.deepEqual(daBia.map((c) => c.nome), padrao);
  assert.notEqual(daAna[0].id, daBia[0].id);
});

test('criar, renomear, reordenar e apagar categoria', async () => {
  const criada = await request(app)
    .post('/categorias-pagamento')
    .set(ana.auth)
    .send({ nome: '  Plano de saúde ' })
    .expect(201);
  assert.equal(criada.body.nome, 'Plano de saúde');
  assert.equal(criada.body.ordem, CATEGORIAS_PADRAO.length + 1, 'vai para o fim da lista');

  const renomeada = await request(app)
    .put(`/categorias-pagamento/${criada.body.id}`)
    .set(ana.auth)
    .send({ nome: 'Plano médico' })
    .expect(200);
  assert.deepEqual(renomeada.body, { id: criada.body.id, nome: 'Plano médico', ordem: CATEGORIAS_PADRAO.length + 1 });

  const reordenada = await request(app)
    .put(`/categorias-pagamento/${criada.body.id}`)
    .set(ana.auth)
    .send({ ordem: 0 })
    .expect(200);
  assert.equal(reordenada.body.nome, 'Plano médico');
  assert.equal((await listar(ana))[0].nome, 'Plano médico');

  await request(app).put(`/categorias-pagamento/${criada.body.id}`).set(ana.auth).send({}).expect(400);

  await request(app).delete(`/categorias-pagamento/${criada.body.id}`).set(ana.auth).expect(204);
  assert.equal((await listar(ana)).length, CATEGORIAS_PADRAO.length);
});

test('nome repetido sem diferenciar maiúsculas responde 409', async () => {
  const res = await request(app)
    .post('/categorias-pagamento')
    .set(ana.auth)
    .send({ nome: 'OUTROS' })
    .expect(409);
  assert.equal(res.body.erro.codigo, 'CATEGORIA_DUPLICADA');

  const [primeira] = await listar(ana);
  await request(app)
    .put(`/categorias-pagamento/${primeira.id}`)
    .set(ana.auth)
    .send({ nome: 'outros' })
    .expect(409);

  // Outro usuário pode usar o mesmo nome.
  await request(app).post('/categorias-pagamento').set(bia.auth).send({ nome: 'Pets' }).expect(201);
  await request(app).post('/categorias-pagamento').set(ana.auth).send({ nome: 'Pets' }).expect(201);
});

test('apagar categoria com contas responde 409', async () => {
  const [primeira] = await listar(ana);
  await request(app)
    .post('/pagamentos')
    .set(ana.auth)
    .send({ descricao: 'Salário', categoriaId: primeira.id, valorCentavos: 150000, vencimento: '2026-10-05' })
    .expect(201);
  const res = await request(app).delete(`/categorias-pagamento/${primeira.id}`).set(ana.auth).expect(409);
  assert.equal(res.body.erro.codigo, 'REFERENCIA_INVALIDA');
});

test('categoria de outro usuário: 404 e não serve para conta', async () => {
  const [daBia] = await listar(bia);
  await request(app).put(`/categorias-pagamento/${daBia.id}`).set(ana.auth).send({ nome: 'X' }).expect(404);
  await request(app).delete(`/categorias-pagamento/${daBia.id}`).set(ana.auth).expect(404);
  await request(app)
    .post('/pagamentos')
    .set(ana.auth)
    .send({ descricao: 'Luz', categoriaId: daBia.id, valorCentavos: 1000, vencimento: '2026-10-05' })
    .expect(400);
});

test('rotas de categoria exigem token', async () => {
  await request(app).post('/categorias-pagamento').send({ nome: 'X' }).expect(401);
});

test('migration 16 dá "Outros" no fim a quem já tem conta, sem duplicar', async () => {
  const { up } = require('../db/migrations/20261016000016_categoria_outros');
  const outrosDe = (sessao) => db('categoriaPagamento').where({ usuarioId: sessao.usuario.id }).whereRaw("lower(nome) = 'outros'");
  // Conta de antes da migration (sem "Outros") e conta que já criou uma com outra caixa.
  await outrosDe(ana).del();
  await outrosDe(bia).update({ nome: 'OUTROS' });

  await up(db);
  await up(db);

  const daAna = await listar(ana);
  assert.equal(daAna.at(-1).nome, 'Outros');
  assert.equal(daAna.at(-1).ordem, Math.max(...daAna.slice(0, -1).map((c) => c.ordem)) + 1);
  assert.equal((await outrosDe(ana)).length, 1);
  assert.deepEqual((await outrosDe(bia)).map((c) => c.nome), ['OUTROS']);
});
