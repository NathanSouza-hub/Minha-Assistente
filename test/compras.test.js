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

const criar = async (sessao, dados) =>
  (await request(app).post('/compras').set(sessao.auth).send(dados).expect(201)).body;

const listar = async (sessao, query = {}) =>
  (await request(app).get('/compras').query(query).set(sessao.auth).expect(200)).body;

const marcar = (sessao, id, corpo) => request(app).patch(`/compras/${id}/comprado`).set(sessao.auth).send(corpo);

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

test('cria item pendente; texto vazio vira null; valida nome', async () => {
  const item = await criar(ana, { nome: ' Leite ', categoria: 'Mercado', quantidade: '' });
  assert.equal(item.nome, 'Leite');
  assert.equal(item.quantidade, null);
  assert.equal(item.comprado, false);
  assert.equal(item.compradoEm, null);

  const res = await request(app).post('/compras').set(ana.auth).send({ nome: '' }).expect(400);
  assert.match(res.body.erro.mensagem, /nome: Informe o item/);
});

test('marcar e desmarcar comprado; sem corpo marca', async () => {
  const item = await criar(ana, { nome: 'Pão' });
  const marcado = await marcar(ana, item.id).expect(200);
  assert.equal(marcado.body.comprado, true);
  assert.match(marcado.body.compradoEm, /-03:00$/);

  const desmarcado = await marcar(ana, item.id, { comprado: false }).expect(200);
  assert.equal(desmarcado.body.comprado, false);
  assert.equal(desmarcado.body.compradoEm, null);
});

test('ordem: pendentes por categoria e nome, depois comprados; filtro por status', async () => {
  const sessao = await criarSessao(app);
  await criar(sessao, { nome: 'Sabão', categoria: 'Mercado' });
  await criar(sessao, { nome: 'Dipirona', categoria: 'Farmácia' });
  await criar(sessao, { nome: 'Pilhas' });
  const arroz = await criar(sessao, { nome: 'Arroz', categoria: 'Mercado' });
  await marcar(sessao, arroz.id).expect(200);

  assert.deepEqual((await listar(sessao)).map((i) => i.nome), ['Dipirona', 'Sabão', 'Pilhas', 'Arroz']);
  assert.deepEqual((await listar(sessao, { comprado: 'true' })).map((i) => i.nome), ['Arroz']);
  assert.equal((await listar(sessao, { comprado: 'false' })).length, 3);
  await request(app).get('/compras').query({ comprado: 'talvez' }).set(sessao.auth).expect(400);
});

test('ordem do português: sem separar maiúsculas e com acentos no lugar', async () => {
  const sessao = await criarSessao(app);
  for (const [nome, categoria] of [
    ['leite', 'Mercado'],
    ['Arroz', 'Mercado'],
    ['Açúcar', 'Mercado'],
    ['Pomada', 'farmácia'],
    ['Bananas', 'Feira'],
  ]) {
    await criar(sessao, { nome, categoria });
  }
  assert.deepEqual(
    (await listar(sessao)).map((i) => `${i.categoria}/${i.nome}`),
    ['farmácia/Pomada', 'Feira/Bananas', 'Mercado/Açúcar', 'Mercado/Arroz', 'Mercado/leite'],
  );
});

test('PUT edita sem mexer no status; isolamento e exclusão', async () => {
  const item = await criar(ana, { nome: 'Café' });
  await marcar(ana, item.id).expect(200);
  const { body: editado } = await request(app)
    .put(`/compras/${item.id}`)
    .set(ana.auth)
    .send({ nome: 'Café em grãos', quantidade: '1 kg' })
    .expect(200);
  assert.equal(editado.nome, 'Café em grãos');
  assert.equal(editado.comprado, true, 'editar não desmarca');

  await request(app).put(`/compras/${item.id}`).set(bia.auth).send({ nome: 'X' }).expect(404);
  await marcar(bia, item.id).expect(404);
  await request(app).delete(`/compras/${item.id}`).set(bia.auth).expect(404);
  assert.ok(!(await listar(bia)).some((i) => i.id === item.id));

  await request(app).delete(`/compras/${item.id}`).set(ana.auth).expect(204);
  await request(app).delete(`/compras/${item.id}`).set(ana.auth).expect(404);
  await request(app).get('/compras').expect(401);
});
