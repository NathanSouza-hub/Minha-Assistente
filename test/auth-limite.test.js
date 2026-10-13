require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;

before(async () => {
  await prepararBanco(db);
  app = criarApp(); // app novo: contador de tentativas zerado
});

after(async () => {
  await db.destroy();
});

test('login bloqueia o IP após 10 tentativas erradas, mas acertos não contam', async () => {
  const sessao = await criarSessao(app, { email: 'limite@exemplo.com' });

  // Acertos não entram na conta.
  for (let i = 0; i < 3; i += 1) {
    await request(app).post('/auth/login').send({ email: 'limite@exemplo.com', senha: sessao.senha }).expect(200);
  }

  for (let i = 0; i < 10; i += 1) {
    await request(app).post('/auth/login').send({ email: 'limite@exemplo.com', senha: 'errada' }).expect(401);
  }

  const bloqueado = await request(app)
    .post('/auth/login')
    .send({ email: 'limite@exemplo.com', senha: sessao.senha })
    .expect(429);
  assert.equal(bloqueado.body.erro.codigo, 'LIMITE_TENTATIVAS');
});
