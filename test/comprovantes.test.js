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
let categoriaId;

const criarConta = async (sessao, extra = {}) =>
  (
    await request(app)
      .post('/pagamentos')
      .set(sessao.auth)
      .send({ descricao: 'Salário da Joana', valorCentavos: 250000, vencimento: '2026-11-05', categoriaId, ...extra })
      .expect(201)
  ).body;

const anexar = (sessao, pagamentoId, conteudo, nome) =>
  request(app).post(`/pagamentos/${pagamentoId}/comprovantes`).set(sessao.auth).attach('arquivo', conteudo, nome);

const binario = (res, callback) => {
  const partes = [];
  res.on('data', (parte) => partes.push(parte));
  res.on('end', () => callback(null, Buffer.concat(partes)));
};

const caminhoDe = async (comprovanteId) => (await db('pagamentoComprovante').where({ id: comprovanteId }).first()).caminho;
const existeNoDisco = (caminho) => fs.existsSync(path.join(armazenamento.RAIZ, caminho));
// Os arquivos saem depois que a transação confirma (em segundo plano).
const esperarSumir = async (caminho) => {
  for (let i = 0; i < 50 && existeNoDisco(caminho); i++) await new Promise((r) => setTimeout(r, 20));
  return !existeNoDisco(caminho);
};

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
  categoriaId = (await request(app).get('/categorias-pagamento').set(ana.auth)).body[0].id;
});

after(async () => {
  await db.destroy();
});

test('anexa, lista no detalhe, conta na lista e baixa com o nome original', async () => {
  const conta = await criarConta(ana);
  assert.equal(conta.totalComprovantes, 0);

  const { body: comprovante } = await anexar(ana, conta.id, PDF, 'comprovante-salário.pdf').expect(201);
  assert.equal(comprovante.nomeOriginal, 'comprovante-salário.pdf');
  assert.equal(comprovante.mimeType, 'application/pdf');
  assert.equal('caminho' in comprovante, false, 'o caminho no disco não é exposto');

  const { body: detalhe } = await request(app).get(`/pagamentos/${conta.id}`).set(ana.auth).expect(200);
  assert.deepEqual(detalhe.comprovantes.map((c) => c.id), [comprovante.id]);
  assert.equal(detalhe.totalComprovantes, 1);
  const { body: lista } = await request(app).get('/pagamentos?inicio=2026-11-01&fim=2026-11-30').set(ana.auth);
  assert.equal(lista.find((p) => p.id === conta.id).totalComprovantes, 1);
  assert.equal('comprovantes' in lista[0], false, 'a lista só traz a contagem');

  const res = await request(app)
    .get(`/pagamentos/${conta.id}/comprovantes/${comprovante.id}`)
    .set(ana.auth)
    .buffer(true)
    .parse(binario)
    .expect(200);
  assert.match(res.headers['content-type'], /^application\/pdf/);
  assert.match(res.headers['content-disposition'], /^attachment/);
  assert.ok(res.body.equals(PDF));
});

test('recusa tipo errado, outra pessoa e mais de 5 por conta', async () => {
  const conta = await criarConta(ana);
  const errado = await anexar(ana, conta.id, TEXTO, 'falso.pdf').expect(415);
  assert.equal(errado.body.erro.codigo, 'TIPO_NAO_SUPORTADO');

  const { body: comprovante } = await anexar(ana, conta.id, PNG, 'foto.png').expect(201);
  await anexar(bia, conta.id, PDF, 'a.pdf').expect(404);
  await request(app).get(`/pagamentos/${conta.id}/comprovantes/${comprovante.id}`).set(bia.auth).expect(404);
  await request(app).delete(`/pagamentos/${conta.id}/comprovantes/${comprovante.id}`).set(bia.auth).expect(404);

  for (let i = 0; i < 4; i++) await anexar(ana, conta.id, PDF, `c${i}.pdf`).expect(201);
  const demais = await anexar(ana, conta.id, PDF, 'sexto.pdf').expect(409);
  assert.equal(demais.body.erro.codigo, 'LIMITE_ANEXOS');
});

test('excluir o comprovante ou a conta apaga o arquivo do disco', async () => {
  const conta = await criarConta(ana);
  const { body: um } = await anexar(ana, conta.id, PDF, 'um.pdf').expect(201);
  const { body: dois } = await anexar(ana, conta.id, PDF, 'dois.pdf').expect(201);
  const [caminhoUm, caminhoDois] = [await caminhoDe(um.id), await caminhoDe(dois.id)];

  await request(app).delete(`/pagamentos/${conta.id}/comprovantes/${um.id}`).set(ana.auth).expect(204);
  assert.equal(existeNoDisco(caminhoUm), false);

  await request(app).delete(`/pagamentos/${conta.id}`).set(ana.auth).expect(204);
  assert.ok(await esperarSumir(caminhoDois));
  assert.equal(await db('pagamentoComprovante').where({ id: dois.id }).first(), undefined);
});

test('fatura de cartão aceita comprovante; se a fatura some, o arquivo vai junto', async () => {
  const { body: cartao } = await request(app)
    .post('/cartoes')
    .set(ana.auth)
    .send({ nome: 'Itaú', cor: 'azul', diaFechamento: 3, diaVencimento: 10 })
    .expect(201);
  const { body: compra } = await request(app)
    .post(`/cartoes/${cartao.id}/compras`)
    .set(ana.auth)
    .send({ descricao: 'Farmácia', valorTotalCentavos: 8990, parcelas: 1, dataCompra: '2999-01-15' })
    .expect(201);
  const fatura = await db('pagamento').where({ cartaoId: cartao.id }).first();

  const { body: comprovante } = await anexar(ana, fatura.id, PDF, 'fatura.pdf').expect(201);
  const caminho = await caminhoDe(comprovante.id);

  // Sem compras, a fatura pendente deixa de existir (e o comprovante com ela).
  await request(app).delete(`/cartoes/${cartao.id}/compras/${compra.id}`).set(ana.auth).expect(204);
  assert.equal(await db('pagamento').where({ id: fatura.id }).first(), undefined);
  assert.ok(await esperarSumir(caminho));
});
