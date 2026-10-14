require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const armazenamento = require('../src/lib/armazenamento');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

const PDF = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n', 'latin1');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const TEXTO = Buffer.from('isto não é um pdf, é só texto qualquer');

let app;
let ana;
let bia;

const lisboa = (extra = {}) => ({
  destino: 'Lisboa',
  ida: '2026-12-20',
  volta: '2027-01-05',
  hospedagem: 'Hotel Avenida',
  transporte: 'Voo TP 088',
  ...extra,
});

const criarViagem = async (sessao, dados = lisboa()) =>
  (await request(app).post('/viagens').set(sessao.auth).send(dados).expect(201)).body;

const anexar = (sessao, viagemId, conteudo, nome, contentType = 'application/octet-stream') =>
  request(app).post(`/viagens/${viagemId}/anexos`).set(sessao.auth).attach('arquivo', conteudo, { filename: nome, contentType });

// Lê a resposta binária como Buffer.
const binario = (res, callback) => {
  const partes = [];
  res.on('data', (parte) => partes.push(parte));
  res.on('end', () => callback(null, Buffer.concat(partes)));
};

const existeNoDisco = (caminho) => fs.existsSync(path.join(armazenamento.RAIZ, caminho));

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

test('CRUD de viagem e validações', async () => {
  const viagem = await criarViagem(ana);
  assert.equal(viagem.destino, 'Lisboa');
  assert.equal(viagem.volta, '2027-01-05');
  assert.deepEqual(viagem.anexos, []);

  const invalida = await request(app).post('/viagens').set(ana.auth).send(lisboa({ volta: '2026-12-01' })).expect(400);
  assert.match(invalida.body.erro.mensagem, /volta: A volta precisa ser no mesmo dia ou depois da ida/);

  const editada = await request(app)
    .put(`/viagens/${viagem.id}`)
    .set(ana.auth)
    .send(lisboa({ destino: 'Porto', volta: null, hospedagem: '' }))
    .expect(200);
  assert.equal(editada.body.destino, 'Porto');
  assert.equal(editada.body.volta, null);
  assert.equal(editada.body.hospedagem, null);

  await criarViagem(ana, lisboa({ destino: 'Serra', ida: '2027-02-01', volta: null }));
  const lista = (await request(app).get('/viagens').set(ana.auth).expect(200)).body;
  assert.deepEqual(lista.map((v) => v.destino), ['Serra', 'Porto'], 'ida mais recente primeiro');
});

test('envia, lista e baixa um PDF com o nome original', async () => {
  const viagem = await criarViagem(ana);
  const { body: anexo } = await anexar(ana, viagem.id, PDF, 'passagem-ônibus.pdf', 'application/pdf').expect(201);
  assert.equal(anexo.nomeOriginal, 'passagem-ônibus.pdf');
  assert.equal(anexo.mimeType, 'application/pdf');
  assert.equal(anexo.tamanhoBytes, PDF.length);
  assert.equal('caminho' in anexo, false, 'o caminho no disco não é exposto');

  const { body: detalhe } = await request(app).get(`/viagens/${viagem.id}`).set(ana.auth).expect(200);
  assert.deepEqual(detalhe.anexos.map((a) => a.id), [anexo.id]);

  const res = await request(app)
    .get(`/viagens/${viagem.id}/anexos/${anexo.id}`)
    .set(ana.auth)
    .buffer(true)
    .parse(binario)
    .expect(200);
  assert.match(res.headers['content-type'], /^application\/pdf/);
  assert.match(res.headers['content-disposition'], /^attachment;/);
  assert.match(res.headers['content-disposition'], /filename\*=UTF-8''passagem-%C3%B4nibus\.pdf/);
  assert.ok(res.body.equals(PDF));
});

test('tipo é decidido pelo conteúdo: texto disfarçado é recusado, PNG com rótulo errado vira PNG', async () => {
  const viagem = await criarViagem(ana);
  const falso = await anexar(ana, viagem.id, TEXTO, 'falso.pdf', 'application/pdf').expect(415);
  assert.equal(falso.body.erro.codigo, 'TIPO_NAO_SUPORTADO');

  const { body: png } = await anexar(ana, viagem.id, PNG, 'foto.pdf', 'application/pdf').expect(201);
  assert.equal(png.mimeType, 'image/png');
});

test('erros de upload: sem arquivo, campo errado e arquivo grande demais', async () => {
  const viagem = await criarViagem(ana);

  const semArquivo = await request(app).post(`/viagens/${viagem.id}/anexos`).set(ana.auth).field('x', '1').expect(400);
  assert.match(semArquivo.body.erro.mensagem, /arquivo/);

  const campoErrado = await request(app)
    .post(`/viagens/${viagem.id}/anexos`)
    .set(ana.auth)
    .attach('documento', PDF, 'a.pdf')
    .expect(400);
  assert.equal(campoErrado.body.erro.codigo, 'UPLOAD_INVALIDO');

  const grande = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
  const res = await anexar(ana, viagem.id, grande, 'grande.pdf').expect(413);
  assert.equal(res.body.erro.codigo, 'ARQUIVO_GRANDE_DEMAIS');
});

test('outro usuário não envia, baixa nem apaga anexos (404)', async () => {
  const viagem = await criarViagem(ana);
  const { body: anexo } = await anexar(ana, viagem.id, PDF, 'voucher.pdf').expect(201);

  await anexar(bia, viagem.id, PDF, 'intruso.pdf').expect(404);
  await request(app).get(`/viagens/${viagem.id}/anexos/${anexo.id}`).set(bia.auth).expect(404);
  await request(app).delete(`/viagens/${viagem.id}/anexos/${anexo.id}`).set(bia.auth).expect(404);
  await request(app).get(`/viagens/${viagem.id}`).set(bia.auth).expect(404);
  await request(app).put(`/viagens/${viagem.id}`).set(bia.auth).send(lisboa()).expect(404);
  await request(app).delete(`/viagens/${viagem.id}`).set(bia.auth).expect(404);
});

test('apagar anexo e viagem remove os arquivos do disco', async () => {
  const viagem = await criarViagem(ana);
  const { body: a1 } = await anexar(ana, viagem.id, PDF, 'a1.pdf').expect(201);
  const { body: a2 } = await anexar(ana, viagem.id, PNG, 'a2.png').expect(201);
  const caminhos = Object.fromEntries(
    (await db('viagemAnexo').whereIn('id', [a1.id, a2.id]).select('id', 'caminho')).map((l) => [l.id, l.caminho]),
  );
  assert.ok(existeNoDisco(caminhos[a1.id]) && existeNoDisco(caminhos[a2.id]));

  await request(app).delete(`/viagens/${viagem.id}/anexos/${a1.id}`).set(ana.auth).expect(204);
  assert.equal(existeNoDisco(caminhos[a1.id]), false);
  await request(app).get(`/viagens/${viagem.id}/anexos/${a1.id}`).set(ana.auth).expect(404);

  await request(app).delete(`/viagens/${viagem.id}`).set(ana.auth).expect(204);
  assert.equal(existeNoDisco(caminhos[a2.id]), false);
  assert.equal(await db('viagemAnexo').where({ id: a2.id }).first(), undefined);
});

test('armazenamento recusa caminhos fora da pasta', () => {
  assert.throws(() => armazenamento.caminhoAbsoluto('../segredo.txt'), /Caminho de arquivo inválido/);
});
