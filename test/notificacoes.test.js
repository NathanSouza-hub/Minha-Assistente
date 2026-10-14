require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const webpush = require('web-push');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;
let ana;
let bia;

// Chaves no formato de um navegador de verdade: ponto P-256 (65 bytes) e segredo de 16 bytes.
const chaves = () => ({
  p256dh: crypto.createECDH('prime256v1').generateKeys().toString('base64url'),
  auth: crypto.randomBytes(16).toString('base64url'),
});

let contador = 0;
const inscricao = () => {
  contador += 1;
  return { endpoint: `https://fcm.googleapis.com/fcm/send/${contador}`, expirationTime: null, keys: chaves() };
};

const inscrever = (sessao, dados, status = 201) =>
  request(app).post('/notificacoes/inscricoes').set(sessao.auth).send(dados).expect(status);

const inscricoesDe = (sessao) => db('pushInscricao').where({ usuarioId: sessao.usuario.id }).pluck('endpoint');

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

test('chave pública para o navegador se inscrever', async () => {
  const { body } = await request(app).get('/notificacoes/chave-publica').set(ana.auth).expect(200);
  assert.equal(body.chavePublica, process.env.VAPID_PUBLIC_KEY);
  await request(app).get('/notificacoes/chave-publica').expect(401);
});

test('inscreve, atualiza a mesma inscrição e passa o aparelho para quem entrou nele', async () => {
  const dados = inscricao();
  const { body } = await inscrever(ana, dados);
  assert.equal(body.endpoint, dados.endpoint);
  assert.ok(body.id);

  // Mesmo navegador de novo (ex.: chaves renovadas): atualiza, não duplica.
  const novas = chaves();
  const { body: denovo } = await inscrever(ana, { ...dados, keys: novas });
  assert.equal(denovo.id, body.id);
  assert.equal((await db('pushInscricao').where({ endpoint: dados.endpoint }).first()).auth, novas.auth);

  // A Bia entrou no mesmo aparelho.
  await inscrever(bia, dados);
  assert.deepEqual(await inscricoesDe(ana), []);
  assert.deepEqual(await inscricoesDe(bia), [dados.endpoint]);
});

test('valida a inscrição', async () => {
  const casos = [
    [{ ...inscricao(), endpoint: 'http://fcm.googleapis.com/fcm/send/x' }, /endpoint/],
    [{ ...inscricao(), endpoint: 'https://169.254.169.254/latest' }, /Serviço de push não reconhecido/],
    [{ ...inscricao(), endpoint: 'https://api:3000/auth' }, /Serviço de push não reconhecido/],
    [{ ...inscricao(), endpoint: 'https://fcm.googleapis.com:8443/x' }, /Serviço de push não reconhecido/],
    [{ ...inscricao(), endpoint: 'https://fcm.googleapis.com.evil.com/x' }, /Serviço de push não reconhecido/],
    [{ ...inscricao(), endpoint: 'https://evilnotify.windows.com/x' }, /Serviço de push não reconhecido/],
    [{ ...inscricao(), keys: { ...chaves(), p256dh: 'tem espaço' } }, /keys\.p256dh/],
    [{ ...inscricao(), keys: { ...chaves(), p256dh: 'BNcRdreALRFXTkOO' } }, /keys\.p256dh: A chave precisa ter 65 bytes/],
    [{ ...inscricao(), keys: { ...chaves(), auth: 'curta' } }, /keys\.auth: A chave precisa ter 16 bytes/],
    [{ endpoint: inscricao().endpoint }, /keys/],
  ];
  for (const [dados, mensagem] of casos) {
    const { body } = await inscrever(ana, dados, 400);
    assert.equal(body.erro.codigo, 'VALIDACAO');
    assert.match(body.erro.mensagem, mensagem);
  }
});

test('cancelar é idempotente e só mexe nas inscrições do próprio usuário', async () => {
  const daAna = inscricao();
  await inscrever(ana, daAna);
  await request(app).delete('/notificacoes/inscricoes').set(bia.auth).send({ endpoint: daAna.endpoint }).expect(204);
  assert.ok((await inscricoesDe(ana)).includes(daAna.endpoint));

  await request(app).delete('/notificacoes/inscricoes').set(ana.auth).send({ endpoint: daAna.endpoint }).expect(204);
  await request(app).delete('/notificacoes/inscricoes').set(ana.auth).send({ endpoint: daAna.endpoint }).expect(204);
  assert.ok(!(await inscricoesDe(ana)).includes(daAna.endpoint));
});

test('teste: envia para todos os aparelhos; inscrição expirada é apagada', async (t) => {
  const carla = await criarSessao(app);
  const { body: semAparelho } = await request(app).post('/notificacoes/teste').set(carla.auth).expect(409);
  assert.equal(semAparelho.erro.codigo, 'SEM_INSCRICAO');

  const celular = inscricao();
  const antigo = inscricao();
  await inscrever(carla, celular);
  await inscrever(carla, antigo);
  const enviados = [];
  t.mock.method(webpush, 'sendNotification', async (sub, carga, opcoes) => {
    if (sub.endpoint === antigo.endpoint) {
      throw new webpush.WebPushError('Gone', 410, {}, '', sub.endpoint);
    }
    enviados.push({ endpoint: sub.endpoint, keys: sub.keys, carga: JSON.parse(carga), ttl: opcoes.TTL });
    return { statusCode: 201 };
  });

  await request(app).post('/notificacoes/teste').set(carla.auth).expect(204);
  assert.deepEqual(enviados, [
    {
      endpoint: celular.endpoint,
      keys: celular.keys,
      carga: {
        titulo: 'Notificações ligadas',
        corpo: 'É assim que os lembretes vão aparecer neste aparelho.',
        url: '/',
        tag: 'teste',
      },
      ttl: 3600,
    },
  ]);
  assert.deepEqual(await inscricoesDe(carla), [celular.endpoint]);
});

test('teste: todas as inscrições expiradas → 409; outro erro do serviço → 500', async (t) => {
  const davi = await criarSessao(app);
  await inscrever(davi, inscricao());
  const envio = t.mock.method(webpush, 'sendNotification', async () => {
    throw new webpush.WebPushError('Gone', 410, {}, '', '');
  });
  const { body } = await request(app).post('/notificacoes/teste').set(davi.auth).expect(409);
  assert.equal(body.erro.mensagem, 'As inscrições dos aparelhos expiraram.');
  assert.deepEqual(await inscricoesDe(davi), []);

  await inscrever(davi, inscricao());
  envio.mock.mockImplementation(async () => {
    throw new webpush.WebPushError('Erro no serviço', 500, {}, '', '');
  });
  await request(app).post('/notificacoes/teste').set(davi.auth).expect(500);
  assert.equal((await inscricoesDe(davi)).length, 1);
});

test('aceita os serviços de push dos navegadores', async () => {
  for (const endpoint of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-bl2p.notify.windows.com/w/?token=abc',
    'https://FCM.googleapis.com./fcm/send/abc',
  ]) {
    await inscrever(ana, { ...inscricao(), endpoint });
  }
});

test('envio ignora e apaga inscrição gravada fora da lista de serviços de push', async (t) => {
  const elis = await criarSessao(app);
  const valida = inscricao();
  await inscrever(elis, valida);
  const { keys } = inscricao();
  await db('pushInscricao').insert({ usuarioId: elis.usuario.id, endpoint: 'https://api:3000/interno', p256dh: keys.p256dh, auth: keys.auth });

  const destinos = [];
  t.mock.method(webpush, 'sendNotification', async (sub) => {
    destinos.push(sub.endpoint);
    return { statusCode: 201 };
  });
  await request(app).post('/notificacoes/teste').set(elis.auth).expect(204);
  assert.deepEqual(destinos, [valida.endpoint]);
  assert.deepEqual(await inscricoesDe(elis), [valida.endpoint]);
});