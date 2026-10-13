require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { criarBancoSeNaoExistir } = require('./helpers/banco');

let app;

before(async () => {
  await criarBancoSeNaoExistir();
  app = criarApp();
});

after(async () => {
  await db.destroy();
});

test('GET /saude responde ok com banco no ar', async () => {
  const res = await request(app).get('/saude').expect(200);
  assert.deepEqual(res.body, { status: 'ok', banco: 'ok' });
});

test('rota inexistente devolve 404 no formato de erro do contrato', async () => {
  const res = await request(app).get('/nao-existe').expect(404);
  assert.deepEqual(res.body, {
    erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota GET /nao-existe não existe.' },
  });
});

test('JSON malformado devolve 400 JSON_INVALIDO', async () => {
  const res = await request(app)
    .post('/qualquer')
    .set('Content-Type', 'application/json')
    .send('{"quebrado":')
    .expect(400);
  assert.equal(res.body.erro.codigo, 'JSON_INVALIDO');
});

test('GET /docs.json expõe o OpenAPI', async () => {
  const res = await request(app).get('/docs.json').expect(200);
  assert.equal(res.body.openapi, '3.1.0');
  assert.ok(res.body.paths['/saude']);
  assert.ok(res.body.components.securitySchemes.bearerAuth);
});
