require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;

before(async () => {
  await prepararBanco(db);
  app = criarApp();
});

after(async () => {
  await db.destroy();
});

test('cadastro cria a conta, normaliza o e-mail e devolve token sem a senha', async () => {
  const res = await request(app)
    .post('/auth/cadastro')
    .send({ nome: '  Maria Silva ', email: '  Maria@Exemplo.COM ', senha: 'uma-senha-forte' })
    .expect(201);

  assert.equal(typeof res.body.token, 'string');
  assert.deepEqual(Object.keys(res.body.usuario).sort(), ['criadoEm', 'email', 'id', 'nome']);
  assert.equal(res.body.usuario.nome, 'Maria Silva');
  assert.equal(res.body.usuario.email, 'maria@exemplo.com');
  assert.match(res.body.usuario.criadoEm, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);

  const [linha] = await db('usuario').where({ id: res.body.usuario.id });
  assert.notEqual(linha.senhaHash, 'uma-senha-forte');
  assert.match(linha.senhaHash, /^\$2[aby]\$12\$/);
});

test('cadastro com e-mail já usado (outra caixa) devolve 409 EMAIL_EM_USO', async () => {
  await criarSessao(app, { email: 'repetido@exemplo.com' });
  const res = await request(app)
    .post('/auth/cadastro')
    .send({ nome: 'Outra', email: 'REPETIDO@exemplo.com', senha: 'outra-senha-123' })
    .expect(409);
  assert.equal(res.body.erro.codigo, 'EMAIL_EM_USO');
});

test('cadastro com dados inválidos devolve 400 VALIDACAO com mensagem em português', async () => {
  const res = await request(app)
    .post('/auth/cadastro')
    .send({ nome: '', email: 'nao-e-email', senha: '123' })
    .expect(400);
  assert.equal(res.body.erro.codigo, 'VALIDACAO');
  assert.match(res.body.erro.mensagem, /nome: Informe o nome/);
  assert.match(res.body.erro.mensagem, /email: E-mail inválido/);
  assert.match(res.body.erro.mensagem, /senha: A senha precisa ter pelo menos 8 caracteres/);
});

test('login com credenciais certas devolve sessão; e-mail aceita outra caixa', async () => {
  const sessao = await criarSessao(app, { email: 'login@exemplo.com' });
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'LOGIN@exemplo.com', senha: sessao.senha })
    .expect(200);
  assert.equal(res.body.usuario.id, sessao.usuario.id);
  assert.equal(typeof res.body.token, 'string');
});

test('login com senha errada ou e-mail inexistente devolve o mesmo 401', async () => {
  await criarSessao(app, { email: 'senha-errada@exemplo.com' });
  const senhaErrada = await request(app)
    .post('/auth/login')
    .send({ email: 'senha-errada@exemplo.com', senha: 'nao-e-esta' })
    .expect(401);
  const semConta = await request(app)
    .post('/auth/login')
    .send({ email: 'ninguem@exemplo.com', senha: 'qualquer-uma' })
    .expect(401);
  assert.deepEqual(senhaErrada.body, semConta.body);
  assert.equal(senhaErrada.body.erro.codigo, 'CREDENCIAIS_INVALIDAS');
});

test('GET /auth/me devolve o usuário do token', async () => {
  const sessao = await criarSessao(app);
  const res = await request(app).get('/auth/me').set(sessao.auth).expect(200);
  assert.deepEqual(res.body, sessao.usuario);
});

test('GET /auth/me rejeita requisição sem token, token inválido ou de outro segredo', async () => {
  const semToken = await request(app).get('/auth/me').expect(401);
  assert.equal(semToken.body.erro.codigo, 'NAO_AUTORIZADO');

  await request(app).get('/auth/me').set('Authorization', 'Bearer lixo').expect(401);
  await request(app).get('/auth/me').set('Authorization', 'Token abc').expect(401);

  const forjado = jwt.sign({}, 'outro-segredo-com-mais-de-32-caracteres!!', { subject: 'x' });
  await request(app).get('/auth/me').set('Authorization', `Bearer ${forjado}`).expect(401);
});

test('GET /auth/me rejeita token expirado e token de conta apagada', async () => {
  const sessao = await criarSessao(app);

  const expirado = jwt.sign(
    { sub: sessao.usuario.id, exp: Math.floor(Date.now() / 1000) - 60 },
    process.env.JWT_SECRET,
  );
  const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${expirado}`).expect(401);
  assert.equal(res.body.erro.mensagem, 'Sessão expirada. Entre novamente.');

  await db('usuario').where({ id: sessao.usuario.id }).del();
  await request(app).get('/auth/me').set(sessao.auth).expect(401);
});

test('Swagger documenta as rotas de auth', async () => {
  const res = await request(app).get('/docs.json').expect(200);
  for (const rota of ['/auth/cadastro', '/auth/login', '/auth/me']) {
    assert.ok(res.body.paths[rota], `faltou ${rota}`);
  }
  const corpo = res.body.paths['/auth/cadastro'].post.requestBody.content['application/json'].schema;
  assert.deepEqual(corpo.required.sort(), ['email', 'nome', 'senha']);
});
