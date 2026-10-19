require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { hoje } = require('../src/lib/tempo');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;
let ana;
let bia;
let categorias;
let imovelAna;
let imovelBia;

const criar = (sessao, dados, status = 201) =>
  request(app).post('/pagamentos').set(sessao.auth).send(dados).expect(status);

// Categorias são de cada usuário: quem cria a conta precisa usar as suas.
const categoriasDe = async (sessao) => {
  const lista = (await request(app).get('/categorias-pagamento').set(sessao.auth)).body;
  return Object.fromEntries(lista.map((c) => [c.nome, c.id]));
};

const base = (cats = categorias) => ({
  descricao: 'Conta de luz',
  categoriaId: cats['Contas residenciais'],
  valorCentavos: 15990,
  vencimento: '2999-01-10',
});

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
  categorias = await categoriasDe(ana);
  imovelAna = (await request(app).post('/imoveis').set(ana.auth).send({ nome: 'Cobertura' })).body;
  imovelBia = (await request(app).post('/imoveis').set(bia.auth).send({ nome: 'Casa' })).body;
});

after(async () => {
  await db.destroy();
});

test('cria pagamento simples com nomes, padrões e flag de vencido', async () => {
  const { body } = await criar(ana, { ...base(), imovelId: imovelAna.id, observacoes: '  ' });
  assert.equal(body.descricao, 'Conta de luz');
  assert.equal(body.categoriaNome, 'Contas residenciais');
  assert.equal(body.imovelNome, 'Cobertura');
  assert.equal(body.valorCentavos, 15990);
  assert.equal(body.vencimento, '2999-01-10');
  assert.equal(body.status, 'pendente');
  assert.equal(body.dataPagamento, null);
  assert.equal(body.recorrencia, 'nenhuma');
  assert.equal(body.observacoes, null, 'texto em branco vira null');
  assert.equal(body.vencido, false);
  assert.equal('usuarioId' in body, false);

  const vencido = await criar(ana, { ...base(), vencimento: '2000-01-10' });
  assert.equal(vencido.body.vencido, true);
});

test('validações: pago sem data, pendente com data, centavos quebrados, data inexistente', async () => {
  const casos = [
    [{ status: 'pago' }, /dataPagamento: Informe a data do pagamento/],
    [{ dataPagamento: '2026-10-01' }, /dataPagamento: Pagamento pendente não tem data/],
    [{ valorCentavos: 159.9 }, /valorCentavos: O valor deve ser um número inteiro/],
    [{ valorCentavos: 0 }, /valorCentavos: O valor precisa ser maior que zero/],
    [{ vencimento: '2026-02-30' }, /vencimento: Data inválida/],
  ];
  for (const [extra, mensagem] of casos) {
    const res = await criar(ana, { ...base(), ...extra }, 400);
    assert.equal(res.body.erro.codigo, 'VALIDACAO');
    assert.match(res.body.erro.mensagem, mensagem);
  }
});

test('rejeita categoria inexistente e imóvel de outro usuário', async () => {
  const semCategoria = await criar(ana, { ...base(), categoriaId: '00000000-0000-4000-8000-000000000000' }, 400);
  assert.match(semCategoria.body.erro.mensagem, /categoria não encontrada/);

  const imovelAlheio = await criar(ana, { ...base(), imovelId: imovelBia.id }, 400);
  assert.match(imovelAlheio.body.erro.mensagem, /imóvel não encontrado/);
});

test('parcelamento cria N parcelas mensais, respeitando fim de mês, e devolve array', async () => {
  const { body } = await criar(ana, {
    ...base(),
    descricao: 'Geladeira',
    categoriaId: categorias.Outros,
    valorCentavos: 50000,
    vencimento: '2027-01-31',
    parcelamento: { totalParcelas: 4 },
  });
  assert.ok(Array.isArray(body));
  assert.deepEqual(body.map((p) => p.vencimento), ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  assert.deepEqual(body.map((p) => `${p.parcelaAtual}/${p.parcelaTotal}`), ['1/4', '2/4', '3/4', '4/4']);
  assert.equal(new Set(body.map((p) => p.parcelamentoGrupoId)).size, 1);
  assert.ok(body.every((p) => p.valorCentavos === 50000 && p.status === 'pendente'));
});

test('parcelamento não pode ser recorrente nem pago', async () => {
  const recorrente = await criar(ana, { ...base(), recorrencia: 'mensal', parcelamento: { totalParcelas: 3 } }, 400);
  assert.match(recorrente.body.erro.mensagem, /recorrencia: Pagamento parcelado não pode ser recorrente/);
  const pago = await criar(
    ana,
    { ...base(), status: 'pago', dataPagamento: '2026-10-01', parcelamento: { totalParcelas: 3 } },
    400,
  );
  assert.match(pago.body.erro.mensagem, /status: As parcelas são criadas como pendentes/);
});

test('listagem filtra por período, status, categoria e imóvel, e só do próprio usuário', async () => {
  const sessao = await criarSessao(app);
  const cats = await categoriasDe(sessao);
  const { body: imovel } = await request(app).post('/imoveis').set(sessao.auth).send({ nome: 'Serra' });
  await criar(sessao, { ...base(cats), vencimento: '2026-05-01' });
  await criar(sessao, { ...base(cats), vencimento: '2026-05-20', imovelId: imovel.id });
  await criar(sessao, { ...base(cats), vencimento: '2026-06-01', categoriaId: cats.Outros });
  await criar(sessao, { ...base(cats), vencimento: '2026-05-10', status: 'pago', dataPagamento: '2026-05-09' });

  const listar = async (query) =>
    (await request(app).get('/pagamentos').query(query).set(sessao.auth).expect(200)).body;

  assert.equal((await listar({})).length, 4);
  assert.deepEqual(
    (await listar({ inicio: '2026-05-01', fim: '2026-05-31' })).map((p) => p.vencimento),
    ['2026-05-01', '2026-05-10', '2026-05-20'],
  );
  assert.equal((await listar({ status: 'pago' })).length, 1);
  assert.equal((await listar({ categoriaId: cats.Outros })).length, 1);
  assert.equal((await listar({ imovelId: imovel.id })).length, 1);

  const periodoInvertido = await request(app)
    .get('/pagamentos')
    .query({ inicio: '2026-06-01', fim: '2026-05-01' })
    .set(sessao.auth)
    .expect(400);
  assert.match(periodoInvertido.body.erro.mensagem, /fim: O início precisa ser anterior/);
});

test('isolamento: outro usuário recebe 404 em GET, PUT, PATCH e DELETE', async () => {
  const { body: p } = await criar(ana, base());
  await request(app).get(`/pagamentos/${p.id}`).set(bia.auth).expect(404);
  await request(app).put(`/pagamentos/${p.id}`).set(bia.auth).send(base()).expect(404);
  await request(app).patch(`/pagamentos/${p.id}/pagar`).set(bia.auth).expect(404);
  await request(app).delete(`/pagamentos/${p.id}`).set(bia.auth).expect(404);
  await request(app).get(`/pagamentos/${p.id}`).set(ana.auth).expect(200);
});

test('PATCH /pagar usa hoje por padrão e recusa pagar duas vezes', async () => {
  const { body: p } = await criar(ana, base());
  const pago = await request(app).patch(`/pagamentos/${p.id}/pagar`).set(ana.auth).expect(200);
  assert.equal(pago.body.status, 'pago');
  assert.equal(pago.body.dataPagamento, hoje());

  const deNovo = await request(app).patch(`/pagamentos/${p.id}/pagar`).set(ana.auth).expect(409);
  assert.equal(deNovo.body.erro.codigo, 'JA_PAGO');

  const { body: outro } = await criar(ana, base());
  const comData = await request(app)
    .patch(`/pagamentos/${outro.id}/pagar`)
    .set(ana.auth)
    .send({ dataPagamento: '2026-10-01' })
    .expect(200);
  assert.equal(comData.body.dataPagamento, '2026-10-01');
});

test('recorrente mensal do dia 31 gera a próxima sem perder o dia', async () => {
  const sessao = await criarSessao(app);
  const cats = await categoriasDe(sessao);
  const { body: jan } = await criar(sessao, { ...base(cats), vencimento: '2027-01-31', recorrencia: 'mensal' });

  await request(app).patch(`/pagamentos/${jan.id}/pagar`).set(sessao.auth).expect(200);
  let lista = (await request(app).get('/pagamentos').set(sessao.auth)).body;
  const fev = lista.find((p) => p.recorrenciaOrigemId === jan.id);
  assert.equal(fev.vencimento, '2027-02-28');
  assert.equal(fev.status, 'pendente');
  assert.equal(fev.valorCentavos, jan.valorCentavos);

  await request(app).patch(`/pagamentos/${fev.id}/pagar`).set(sessao.auth).expect(200);
  lista = (await request(app).get('/pagamentos').set(sessao.auth)).body;
  const mar = lista.find((p) => p.recorrenciaOrigemId === fev.id);
  assert.equal(mar.vencimento, '2027-03-31');
});

test('recorrente anual e criado já pago geram a próxima; pagar-desfazer-pagar não duplica', async () => {
  const sessao = await criarSessao(app);
  const cats = await categoriasDe(sessao);
  const { body: ipva } = await criar(sessao, {
    ...base(cats),
    descricao: 'IPVA',
    vencimento: '2027-03-15',
    recorrencia: 'anual',
    status: 'pago',
    dataPagamento: '2027-03-10',
  });
  let lista = (await request(app).get('/pagamentos').set(sessao.auth)).body;
  assert.deepEqual(lista.map((p) => p.vencimento), ['2027-03-15', '2028-03-15']);

  // Desfaz o pagamento e paga de novo: a próxima já existe, não cria outra.
  const desfeito = { ...base(cats), descricao: 'IPVA', vencimento: '2027-03-15', recorrencia: 'anual' };
  await request(app).put(`/pagamentos/${ipva.id}`).set(sessao.auth).send(desfeito).expect(200);
  await request(app).patch(`/pagamentos/${ipva.id}/pagar`).set(sessao.auth).expect(200);
  lista = (await request(app).get('/pagamentos').set(sessao.auth)).body;
  assert.equal(lista.length, 2);
});

test('PUT de pendente para pago num recorrente também gera a próxima', async () => {
  const sessao = await criarSessao(app);
  const cats = await categoriasDe(sessao);
  const dados = { ...base(cats), vencimento: '2027-05-05', recorrencia: 'mensal' };
  const { body: p } = await criar(sessao, dados);
  await request(app)
    .put(`/pagamentos/${p.id}`)
    .set(sessao.auth)
    .send({ ...dados, status: 'pago', dataPagamento: '2027-05-04' })
    .expect(200);
  const lista = (await request(app).get('/pagamentos').set(sessao.auth)).body;
  assert.deepEqual(lista.map((x) => x.vencimento), ['2027-05-05', '2027-06-05']);
});

test('PUT recusa tornar uma parcela recorrente', async () => {
  const { body: parcelas } = await criar(ana, { ...base(), parcelamento: { totalParcelas: 2 } });
  const res = await request(app)
    .put(`/pagamentos/${parcelas[0].id}`)
    .set(ana.auth)
    .send({ ...base(), recorrencia: 'mensal' })
    .expect(400);
  assert.match(res.body.erro.mensagem, /parcela não pode ser recorrente/);
});

test('DELETE remove só o pagamento indicado', async () => {
  const { body: parcelas } = await criar(ana, { ...base(), parcelamento: { totalParcelas: 3 } });
  await request(app).delete(`/pagamentos/${parcelas[1].id}`).set(ana.auth).expect(204);
  await request(app).get(`/pagamentos/${parcelas[1].id}`).set(ana.auth).expect(404);
  await request(app).get(`/pagamentos/${parcelas[0].id}`).set(ana.auth).expect(200);
  await request(app).get(`/pagamentos/${parcelas[2].id}`).set(ana.auth).expect(200);
});
