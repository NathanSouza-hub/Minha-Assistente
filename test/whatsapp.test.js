require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const db = require('../src/config/db');
const whatsapp = require('../src/lib/whatsapp');
const { criarApp } = require('../src/app');
const entrada = require('../src/modules/whatsapp/entrada');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;
let ana;
let bia;

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app, { nome: 'Ana' });
  bia = await criarSessao(app, { nome: 'Bia' });
});

after(async () => {
  await db.destroy();
});

let contador = 0;
/** Corpo de webhook como a Meta manda, com uma mensagem de texto. */
function corpoTexto(de, texto, { numeroId = process.env.WHATSAPP_NUMERO_ID, id } = {}) {
  contador += 1;
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '5511999990000', phone_number_id: numeroId },
              contacts: [{ profile: { name: 'Fulana' }, wa_id: de }],
              messages: [{ from: de, id: id ?? `wamid.${contador}`, timestamp: '1761480000', type: 'text', text: { body: texto } }],
            },
          },
        ],
      },
    ],
  };
}

const assinar = (bruto) =>
  `sha256=${crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(bruto).digest('hex')}`;

/** Processa o corpo como o webhook faz e devolve as mensagens que teriam saído. */
async function receber(t, corpo, controle = entrada.criarControle(), agora = Date.now()) {
  const enviadas = [];
  t.mock.method(whatsapp, 'enviarTexto', async (para, texto) => {
    enviadas.push({ para, texto });
    return {};
  });
  await entrada.processar(corpo, controle, agora);
  return enviadas;
}

const gerarCodigo = async (sessao) => (await request(app).post('/whatsapp/codigo').set(sessao.auth).expect(201)).body;

test('verificação do webhook devolve o challenge só com o token certo', async () => {
  const { text } = await request(app)
    .get('/webhooks/whatsapp')
    .query({ 'hub.mode': 'subscribe', 'hub.verify_token': process.env.WHATSAPP_VERIFY_TOKEN, 'hub.challenge': '1158201444' })
    .expect(200);
  assert.equal(text, '1158201444');
  await request(app)
    .get('/webhooks/whatsapp')
    .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'errado', 'hub.challenge': '1' })
    .expect(403);
});

test('webhook recusa corpo sem assinatura ou com assinatura errada e aceita a certa', async () => {
  // Outro número do app: o webhook aceita e ignora (o tratamento roda depois da resposta, fora do teste).
  const bruto = JSON.stringify(corpoTexto('5511900000001', 'oi', { numeroId: '999' }));
  await request(app).post('/webhooks/whatsapp').set('Content-Type', 'application/json').send(bruto).expect(401);
  await request(app)
    .post('/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('X-Hub-Signature-256', assinar(`${bruto} `))
    .send(bruto)
    .expect(401);
  await request(app)
    .post('/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('X-Hub-Signature-256', assinar(bruto))
    .send(bruto)
    .expect(200);
});

test('situação, código e vínculo pelo código; o código só vale uma vez', async (t) => {
  const antes = (await request(app).get('/whatsapp').set(ana.auth).expect(200)).body;
  assert.deepEqual(antes, { disponivel: true, numero: '5511999990000', vinculado: false, telefone: null, vinculadoEm: null });

  const { codigo, link, expiraEm } = await gerarCodigo(ana);
  assert.match(codigo, /^\d{6}$/);
  assert.equal(link, `https://wa.me/5511999990000?text=${codigo}`);
  const minutos = (new Date(expiraEm) - Date.now()) / 60_000;
  assert.ok(minutos > 9 && minutos <= 10);

  const enviadas = await receber(t, corpoTexto('5511987654321', `${codigo.slice(0, 3)} ${codigo.slice(3)}`));
  assert.deepEqual(enviadas, [{ para: '5511987654321', texto: entrada.TEXTOS.vinculado('Ana') }]);

  const depois = (await request(app).get('/whatsapp').set(ana.auth).expect(200)).body;
  assert.equal(depois.vinculado, true);
  assert.equal(depois.telefone, '•••• 4321');
  assert.ok(depois.vinculadoEm);

  // Mandar de novo o mesmo código (de outro número) não liga nada.
  const repetido = await receber(t, corpoTexto('5511900000002', codigo));
  assert.deepEqual(repetido.map((m) => m.texto), [entrada.TEXTOS.codigoInvalido]);
});

test('quem está ligado recebe o aviso da fase 1; mensagem repetida pela Meta é ignorada', async (t) => {
  const { codigo } = await gerarCodigo(bia);
  const controle = entrada.criarControle();
  await receber(t, corpoTexto('5521911112222', codigo), controle);

  const corpo = corpoTexto('5521911112222', 'almoço 45,90', { id: 'wamid.repetida' });
  assert.deepEqual((await receber(t, corpo, controle)).map((m) => m.texto), [entrada.TEXTOS.emBreve('Bia')]);
  assert.deepEqual(await receber(t, corpo, controle), []);
});

test('código vencido não vale; gerar outro troca o anterior', async (t) => {
  const sessao = await criarSessao(app);
  const primeiro = await gerarCodigo(sessao);
  const segundo = await gerarCodigo(sessao);
  assert.notEqual(primeiro.codigo, segundo.codigo);

  const controle = entrada.criarControle();
  const velho = await receber(t, corpoTexto('5531900000003', primeiro.codigo), controle);
  assert.deepEqual(velho.map((m) => m.texto), [entrada.TEXTOS.codigoInvalido]);

  const daqui11min = Date.now() + 11 * 60_000;
  const vencido = await receber(t, corpoTexto('5531900000003', segundo.codigo), controle, daqui11min);
  assert.deepEqual(vencido.map((m) => m.texto), [entrada.TEXTOS.codigoInvalido]);
  assert.equal((await request(app).get('/whatsapp').set(sessao.auth)).body.vinculado, false);
});

test('depois de 5 códigos errados o número para de ser atendido (nem o certo vale)', async (t) => {
  const sessao = await criarSessao(app);
  const controle = entrada.criarControle();
  const { codigo } = await gerarCodigo(sessao);
  const errado = codigo === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i += 1) await receber(t, corpoTexto('5541900000004', errado), controle);
  assert.deepEqual(await receber(t, corpoTexto('5541900000004', codigo), controle), []);
  assert.equal((await request(app).get('/whatsapp').set(sessao.auth)).body.vinculado, false);
  // Outro número com o mesmo código continua podendo ligar.
  const outro = await receber(t, corpoTexto('5541900000005', codigo), controle);
  assert.equal(outro.length, 1);
  assert.equal((await request(app).get('/whatsapp').set(sessao.auth)).body.vinculado, true);
});

test('o número passa para a conta que mandou o código; desligar tira o número', async (t) => {
  const carla = await criarSessao(app, { nome: 'Carla' });
  const davi = await criarSessao(app, { nome: 'Davi' });
  await receber(t, corpoTexto('5551900000006', (await gerarCodigo(carla)).codigo));
  await receber(t, corpoTexto('5551900000006', (await gerarCodigo(davi)).codigo));
  assert.equal((await request(app).get('/whatsapp').set(carla.auth)).body.vinculado, false);
  assert.equal((await request(app).get('/whatsapp').set(davi.auth)).body.vinculado, true);

  await request(app).delete('/whatsapp').set(davi.auth).expect(204);
  assert.equal((await request(app).get('/whatsapp').set(davi.auth)).body.vinculado, false);
  const depois = await receber(t, corpoTexto('5551900000006', 'oi'));
  assert.deepEqual(depois.map((m) => m.texto), [entrada.TEXTOS.desconhecido]);
});

test('número sem conta recebe as instruções uma vez por hora; outro número do app é ignorado', async (t) => {
  const controle = entrada.criarControle();
  const agora = Date.now();
  assert.equal((await receber(t, corpoTexto('5561900000007', 'olá'), controle, agora)).length, 1);
  assert.equal((await receber(t, corpoTexto('5561900000007', 'alô?'), controle, agora + 60_000)).length, 0);
  assert.equal((await receber(t, corpoTexto('5561900000007', 'oi'), controle, agora + 61 * 60_000)).length, 1);
  assert.deepEqual(await receber(t, corpoTexto('5561900000008', 'oi', { numeroId: '999' }), controle), []);
});

test('o texto só vira código quando é só o código', () => {
  assert.equal(entrada.codigoNoTexto(' 123456 '), '123456');
  assert.equal(entrada.codigoNoTexto('123-456'), '123456');
  assert.equal(entrada.codigoNoTexto('Código: 123456'), '123456');
  assert.equal(entrada.codigoNoTexto('paguei 123456'), null);
  assert.equal(entrada.codigoNoTexto('12345'), null);
});

test('rotas do app exigem login', async () => {
  await request(app).get('/whatsapp').expect(401);
  await request(app).post('/whatsapp/codigo').expect(401);
  await request(app).delete('/whatsapp').expect(401);
});
