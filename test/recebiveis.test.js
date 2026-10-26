require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const armazenamento = require('../src/lib/armazenamento');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

const PDF = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n', 'latin1');

let app;
let ana;
let bia;

// Datas fixas no passado (2020: já venceu) ou no futuro (2099: não venceu), para "atrasado" não
// depender do dia em que o teste roda.
const novo = async (sessao, extra = {}) =>
  (
    await request(app)
      .post('/recebiveis')
      .set(sessao.auth)
      .send({ descricao: 'Aluguel da loja', origem: 'aluguel', valorPrevistoCentavos: 300000, dataPrevista: '2099-05-10', ...extra })
      .expect(201)
  ).body;

const receber = (sessao, id, corpo, status = 201) =>
  request(app).post(`/recebiveis/${id}/recebimentos`).set(sessao.auth).send(corpo).expect(status);

const listar = async (sessao, query = {}) =>
  (await request(app).get('/recebiveis').query(query).set(sessao.auth).expect(200)).body;

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

test('cadastra com valores derivados: pendente, nada recebido, saldo = previsto', async () => {
  const r = await novo(ana, { observacoes: '  Loja térrea  ' });
  assert.equal(r.status, 'pendente');
  assert.equal(r.recebidoCentavos, 0);
  assert.equal(r.saldoCentavos, 300000);
  assert.equal(r.atrasado, false);
  assert.equal(r.encerrado, false);
  assert.equal(r.recorrencia, 'nenhuma');
  assert.equal(r.observacoes, 'Loja térrea');
  assert.equal(r.ultimoRecebimento, null);
  assert.equal(r.totalComprovantes, 0);
  assert.equal(r.usuarioId, undefined);
});

test('recebimento parcial e depois o resto: histórico e saldo', async () => {
  const r = await novo(ana, { descricao: 'Honorários do parecer', origem: 'honorarios', valorPrevistoCentavos: 100000 });

  const parcial = (await receber(ana, r.id, { valorCentavos: 40000, data: '2099-05-11', observacoes: 'primeira parte' })).body;
  assert.equal(parcial.status, 'parcial');
  assert.equal(parcial.recebidoCentavos, 40000);
  assert.equal(parcial.saldoCentavos, 60000);
  assert.equal(parcial.recebimentos.length, 1);
  assert.equal(parcial.recebimentos[0].observacoes, 'primeira parte');

  const total = (await receber(ana, r.id, { valorCentavos: 60000, data: '2099-05-20' })).body;
  assert.equal(total.status, 'recebido');
  assert.equal(total.saldoCentavos, 0);
  assert.equal(total.ultimoRecebimento, '2099-05-20');
  assert.deepEqual(total.recebimentos.map((m) => m.valorCentavos), [40000, 60000]);

  const ja = (await receber(ana, r.id, { valorCentavos: 1 }, 409)).body;
  assert.equal(ja.erro.codigo, 'JA_RECEBIDO');
});

test('dividendo variável: recebe menos e encerra; recebe mais que o previsto sem limite', async () => {
  const menor = await novo(ana, { descricao: 'Dividendos ITSA4', origem: 'dividendos', valorPrevistoCentavos: 50000 });
  const encerrado = (await receber(ana, menor.id, { valorCentavos: 42000, encerrar: true })).body;
  assert.equal(encerrado.status, 'recebido');
  assert.equal(encerrado.encerrado, true);
  assert.equal(encerrado.saldoCentavos, 0);

  const maior = await novo(ana, { descricao: 'Dividendos extra', origem: 'dividendos', valorPrevistoCentavos: 50000 });
  const acima = (await receber(ana, maior.id, { valorCentavos: 9_000_000_000_00 })).body;
  assert.equal(acima.status, 'recebido');
  assert.equal(acima.recebidoCentavos, 9_000_000_000_00);
});

test('valores acima do antigo teto de integer são aceitos (bigint)', async () => {
  const grande = await novo(ana, { descricao: 'Venda de imóvel', origem: 'outros', origemDescricao: 'Venda de imóvel', valorPrevistoCentavos: 50_000_000_00 });
  assert.equal(grande.valorPrevistoCentavos, 50_000_000_00);
  const [categoria] = (await request(app).get('/categorias-pagamento').set(ana.auth)).body;
  const pagamento = await request(app)
    .post('/pagamentos')
    .set(ana.auth)
    .send({ descricao: 'Compra de terreno', categoriaId: categoria.id, valorCentavos: 30_000_000_00, vencimento: '2099-06-01' })
    .expect(201);
  assert.equal(pagamento.body.valorCentavos, 30_000_000_00);
});

test('desfazer um recebimento reabre o recebível e o encerramento', async () => {
  const r = await novo(ana, { descricao: 'Rendimento CDB', origem: 'rendimentos', valorPrevistoCentavos: 10000 });
  const depois = (await receber(ana, r.id, { valorCentavos: 8000, encerrar: true })).body;
  assert.equal(depois.status, 'recebido');

  const desfeito = (
    await request(app).delete(`/recebiveis/${r.id}/recebimentos/${depois.recebimentos[0].id}`).set(ana.auth).expect(200)
  ).body;
  assert.equal(desfeito.status, 'pendente');
  assert.equal(desfeito.encerrado, false);
  assert.deepEqual(desfeito.recebimentos, []);

  await request(app).delete(`/recebiveis/${r.id}/recebimentos/${depois.recebimentos[0].id}`).set(ana.auth).expect(404);
});

test('recorrente: ao receber cria a próxima (só uma), a partir do início da série', async () => {
  const r = await novo(ana, { descricao: 'Aluguel apto 31', dataPrevista: '2099-01-31', recorrencia: 'mensal', valorPrevistoCentavos: 200000 });
  const daSerie = (lista) => lista.filter((x) => x.descricao === 'Aluguel apto 31');
  // Parcial ainda não gera a próxima.
  await receber(ana, r.id, { valorCentavos: 100000 });
  assert.equal(daSerie(await listar(ana, { inicio: '2099-02-01', fim: '2099-02-28' })).length, 0);

  await receber(ana, r.id, { valorCentavos: 100000 });
  const fevereiro = daSerie(await listar(ana, { inicio: '2099-02-01', fim: '2099-02-28' }));
  assert.equal(fevereiro.length, 1);
  assert.equal(fevereiro[0].dataPrevista, '2099-02-28');
  assert.equal(fevereiro[0].recorrenciaOrigemId, r.id);
  assert.equal(fevereiro[0].status, 'pendente');

  // Desfazer e receber de novo não duplica a próxima.
  const detalhe = (await request(app).get(`/recebiveis/${r.id}`).set(ana.auth)).body;
  await request(app).delete(`/recebiveis/${r.id}/recebimentos/${detalhe.recebimentos[1].id}`).set(ana.auth).expect(200);
  await receber(ana, r.id, { valorCentavos: 100000 });
  assert.equal((await db('recebivel').where({ recorrenciaOrigemId: r.id })).length, 1);

  // A seguinte volta para o dia 31 (conta do início da série).
  await receber(ana, fevereiro[0].id, { valorCentavos: 200000 });
  const marco = daSerie(await listar(ana, { inicio: '2099-03-01', fim: '2099-03-31' }));
  assert.equal(marco[0].dataPrevista, '2099-03-31');
});

test('sem recorrência configurada não cria próxima', async () => {
  const r = await novo(ana, { descricao: 'Bônus único', origem: 'outros', origemDescricao: 'Bônus', dataPrevista: '2099-07-01' });
  await receber(ana, r.id, { valorCentavos: 300000 });
  assert.equal((await db('recebivel').where({ recorrenciaOrigemId: r.id })).length, 0);
});

test('lista pela data prevista, filtra por status e origem; atrasado só para o que já passou', async () => {
  const velho = await novo(bia, { descricao: 'Aluguel atrasado', dataPrevista: '2020-01-10' });
  await novo(bia, { descricao: 'Dividendo futuro', origem: 'dividendos', dataPrevista: '2099-01-10' });
  const todos = await listar(bia);
  assert.deepEqual(todos.map((x) => x.descricao), ['Aluguel atrasado', 'Dividendo futuro']);
  assert.equal(todos[0].atrasado, true);
  assert.equal(todos[1].atrasado, false);

  assert.deepEqual((await listar(bia, { origem: 'dividendos' })).map((x) => x.descricao), ['Dividendo futuro']);
  assert.deepEqual((await listar(bia, { inicio: '2099-01-01', fim: '2099-12-31' })).map((x) => x.descricao), ['Dividendo futuro']);

  await receber(bia, velho.id, { valorCentavos: 300000 });
  const recebidos = await listar(bia, { status: 'recebido' });
  assert.deepEqual(recebidos.map((x) => x.descricao), ['Aluguel atrasado']);
  assert.equal(recebidos[0].atrasado, false);
  assert.deepEqual((await listar(bia, { status: 'pendente' })).map((x) => x.descricao), ['Dividendo futuro']);
});

test('edição muda só esta ocorrência; exclusão leva recebimentos', async () => {
  const r = await novo(ana, { descricao: 'Aluguel sala', dataPrevista: '2099-09-10' });
  const editado = (
    await request(app)
      .put(`/recebiveis/${r.id}`)
      .set(ana.auth)
      .send({ descricao: 'Aluguel sala 2', origem: 'aluguel', valorPrevistoCentavos: 350000, dataPrevista: '2099-09-15' })
      .expect(200)
  ).body;
  assert.equal(editado.descricao, 'Aluguel sala 2');
  assert.equal(editado.valorPrevistoCentavos, 350000);
  assert.equal(editado.recorrencia, 'nenhuma');

  await receber(ana, r.id, { valorCentavos: 1000 });
  await request(app).delete(`/recebiveis/${r.id}`).set(ana.auth).expect(204);
  await request(app).get(`/recebiveis/${r.id}`).set(ana.auth).expect(404);
  assert.equal((await db('recebimento').where({ recebivelId: r.id })).length, 0);
});

test('isolamento: recebível de outra pessoa responde 404 em tudo', async () => {
  const r = await novo(ana, { descricao: 'Só da Ana' });
  await request(app).get(`/recebiveis/${r.id}`).set(bia.auth).expect(404);
  await request(app)
    .put(`/recebiveis/${r.id}`)
    .set(bia.auth)
    .send({ descricao: 'x', origem: 'outros', origemDescricao: 'x', valorPrevistoCentavos: 1, dataPrevista: '2099-01-01' })
    .expect(404);
  await receber(bia, r.id, { valorCentavos: 1 }, 404);
  await request(app).delete(`/recebiveis/${r.id}`).set(bia.auth).expect(404);
  assert.ok((await listar(bia)).every((x) => x.id !== r.id));
});

test('origem "outros" exige a descrição, guarda junto e copia para a próxima da série', async () => {
  const semDescricao = await request(app)
    .post('/recebiveis')
    .set(ana.auth)
    .send({ descricao: 'x', origem: 'outros', origemDescricao: '   ', valorPrevistoCentavos: 10, dataPrevista: '2099-01-01' })
    .expect(400);
  assert.equal(semDescricao.body.erro.codigo, 'VALIDACAO');
  assert.match(semDescricao.body.erro.mensagem, /Especifique a origem/);

  const r = await novo(ana, {
    descricao: 'Juros do empréstimo ao João',
    origem: 'outros',
    origemDescricao: ' Juros de empréstimo ',
    recorrencia: 'mensal',
    dataPrevista: '2099-08-10',
  });
  assert.equal(r.origem, 'outros');
  assert.equal(r.origemDescricao, 'Juros de empréstimo');
  assert.equal((await listar(ana, { origem: 'outros' })).find((x) => x.id === r.id).origemDescricao, 'Juros de empréstimo');

  await receber(ana, r.id, { valorCentavos: 300000 });
  const [proxima] = await db('recebivel').where({ recorrenciaOrigemId: r.id });
  assert.equal(proxima.origemDescricao, 'Juros de empréstimo');

  // Trocar para outra origem apaga a descrição; outras origens ignoram a enviada.
  const { body: editado } = await request(app)
    .put(`/recebiveis/${proxima.id}`)
    .set(ana.auth)
    .send({ descricao: 'Aluguel', origem: 'aluguel', origemDescricao: 'sobrou', valorPrevistoCentavos: 300000, dataPrevista: '2099-09-10' })
    .expect(200);
  assert.equal(editado.origemDescricao, null);

  // Cadastro antigo (de antes da descrição) continua aparecendo e recebendo normalmente.
  const [{ id: antigo }] = await db('recebivel')
    .insert({ usuarioId: ana.usuario.id, descricao: 'Antigo', origem: 'outros', valorPrevistoCentavos: 100, dataPrevista: '2099-10-01' })
    .returning('id');
  const { body: detalheAntigo } = await request(app).get(`/recebiveis/${antigo}`).set(ana.auth).expect(200);
  assert.equal(detalheAntigo.origemDescricao, null);
  await receber(ana, antigo, { valorCentavos: 100 });
});

test('validações', async () => {
  const semValor = await request(app)
    .post('/recebiveis')
    .set(ana.auth)
    .send({ descricao: 'x', origem: 'aluguel', valorPrevistoCentavos: 0, dataPrevista: '2099-01-01' })
    .expect(400);
  assert.equal(semValor.body.erro.codigo, 'VALIDACAO');
  await request(app)
    .post('/recebiveis')
    .set(ana.auth)
    .send({ descricao: 'x', origem: 'loteria', valorPrevistoCentavos: 10, dataPrevista: '2099-01-01' })
    .expect(400);
  await request(app)
    .post('/recebiveis')
    .set(ana.auth)
    .send({ descricao: 'x', origem: 'aluguel', valorPrevistoCentavos: 10.5, dataPrevista: '2099-02-30' })
    .expect(400);
  const r = await novo(ana, { descricao: 'Valida recebimento' });
  await receber(ana, r.id, { valorCentavos: -5 }, 400);
  await request(app).get('/recebiveis').expect(401);
});

test('comprovantes: anexa, conta no detalhe, baixa e apaga o arquivo junto com o recebível', async () => {
  const r = await novo(ana, { descricao: 'Com comprovante' });
  const anexo = (
    await request(app).post(`/recebiveis/${r.id}/comprovantes`).set(ana.auth).attach('arquivo', PDF, 'extrato.pdf').expect(201)
  ).body;
  assert.equal(anexo.nomeOriginal, 'extrato.pdf');
  const detalhe = (await request(app).get(`/recebiveis/${r.id}`).set(ana.auth)).body;
  assert.equal(detalhe.totalComprovantes, 1);
  assert.equal(detalhe.comprovantes[0].id, anexo.id);

  await request(app).get(`/recebiveis/${r.id}/comprovantes/${anexo.id}`).set(ana.auth).expect(200);
  await request(app).get(`/recebiveis/${r.id}/comprovantes/${anexo.id}`).set(bia.auth).expect(404);
  await request(app).post(`/recebiveis/${r.id}/comprovantes`).set(bia.auth).attach('arquivo', PDF, 'x.pdf').expect(404);

  const { caminho } = await db('recebivelComprovante').where({ id: anexo.id }).first();
  const arquivo = armazenamento.caminhoAbsoluto(caminho);
  assert.ok(fs.existsSync(arquivo));
  await request(app).delete(`/recebiveis/${r.id}`).set(ana.auth).expect(204);
  // O arquivo sai depois que a transação confirma.
  await new Promise((resolver) => setTimeout(resolver, 50));
  assert.equal(fs.existsSync(arquivo), false);
});

test('relatório financeiro: entradas do período, realizado e saldos', async () => {
  const carla = await criarSessao(app);
  const r1 = await novo(carla, { descricao: 'Aluguel mar', origem: 'aluguel', valorPrevistoCentavos: 300000, dataPrevista: '2020-03-05' });
  const r2 = await novo(carla, { descricao: 'Dividendos mar', origem: 'dividendos', valorPrevistoCentavos: 50000, dataPrevista: '2020-03-15' });
  await novo(carla, { descricao: 'Honorários mar', origem: 'honorarios', valorPrevistoCentavos: 70000, dataPrevista: '2020-03-20' });
  await receber(carla, r1.id, { valorCentavos: 100000, data: '2020-03-06' }); // parcial, em março
  await receber(carla, r2.id, { valorCentavos: 50000, data: '2020-04-02' }); // total, em abril
  // Recebimento em março de um recebível de fevereiro: só no realizado de março.
  const fev = await novo(carla, { descricao: 'Aluguel fev', valorPrevistoCentavos: 300000, dataPrevista: '2020-02-05' });
  await receber(carla, fev.id, { valorCentavos: 300000, data: '2020-03-01' });

  const [categoria] = (await request(app).get('/categorias-pagamento').set(carla.auth)).body;
  await request(app)
    .post('/pagamentos')
    .set(carla.auth)
    .send({ descricao: 'Luz', categoriaId: categoria.id, valorCentavos: 20000, vencimento: '2020-03-10', status: 'pago', dataPagamento: '2020-03-10' })
    .expect(201);

  const r = (
    await request(app).get('/relatorios/financeiro').query({ inicio: '2020-03-01', fim: '2020-03-31' }).set(carla.auth).expect(200)
  ).body;
  assert.deepEqual(r.entradas, {
    totalCentavos: 420000,
    recebidoCentavos: 150000,
    pendenteCentavos: 270000,
    vencidoCentavos: 270000,
    recebidoNoPeriodoCentavos: 400000,
    porOrigem: [
      { origem: 'dividendos', totalCentavos: 50000, recebidoCentavos: 50000, pendenteCentavos: 0 },
      { origem: 'aluguel', totalCentavos: 300000, recebidoCentavos: 100000, pendenteCentavos: 200000 },
      { origem: 'honorarios', totalCentavos: 70000, recebidoCentavos: 0, pendenteCentavos: 70000 },
    ],
  });
  assert.deepEqual(r.saldo, { realizadoCentavos: 400000 - 20000, projetadoCentavos: 420000 - 20000 });
});
