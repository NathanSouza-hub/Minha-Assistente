require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { DateTime } = require('luxon');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { CATEGORIAS_PADRAO } = require('../src/modules/categorias/padrao');
const { hoje } = require('../src/lib/tempo');
const { garantirContas } = require('../src/modules/equipe/contas');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;
let ana;
let bia;

const dadosMembro = (extra = {}) => ({
  nome: 'Joana',
  funcao: 'Cuidadora',
  formaPagamento: 'mensal',
  chavePix: 'joana@exemplo.com',
  dias: [{ dia: 5, valorPrevistoCentavos: 150000 }, { dia: 20 }],
  ...extra,
});

const criarMembro = async (sessao, extra = {}, status = 201) =>
  (await request(app).post('/equipe').set(sessao.auth).send(dadosMembro(extra)).expect(status)).body;

const contasDe = async (membroId) =>
  db('pagamento').where({ membroId }).orderBy('vencimento').select('vencimento', 'valorCentavos', 'status', 'descricao');

// Vencimentos do mês atual e do seguinte para um dia, a partir de hoje (o cadastro é de hoje).
const esperados = (dia) => {
  const agora = DateTime.fromISO(hoje());
  return [0, 1]
    .map((m) => agora.startOf('month').plus({ months: m }))
    .map((mes) => mes.set({ day: Math.min(dia, mes.daysInMonth) }).toISODate())
    .filter((data) => data >= hoje());
};

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

test('cadastro novo começa com as categorias padrão (sem Salários e Honorários)', async () => {
  const { body } = await request(app).get('/categorias-pagamento').set(ana.auth).expect(200);
  assert.deepEqual(
    body.map((c) => c.nome),
    CATEGORIAS_PADRAO,
  );
});

test('cria, lista, busca e edita pessoa da equipe', async () => {
  const membro = await criarMembro(ana, { nome: 'Carla' });
  assert.equal(membro.nome, 'Carla');
  assert.equal(membro.funcao, 'Cuidadora');
  assert.equal(membro.formaPagamento, 'mensal');
  assert.equal(membro.chavePix, 'joana@exemplo.com');
  assert.equal(membro.ativo, true);
  assert.deepEqual(membro.dias, [
    { dia: 5, valorPrevistoCentavos: 150000 },
    { dia: 20, valorPrevistoCentavos: null },
  ]);
  assert.equal('usuarioId' in membro, false);

  const { body: editado } = await request(app)
    .put(`/equipe/${membro.id}`)
    .set(ana.auth)
    .send(dadosMembro({ nome: 'Carla', funcao: null, formaPagamento: 'plantao', chavePix: null, dias: [{ dia: 10 }] }))
    .expect(200);
  assert.equal(editado.funcao, null);
  assert.equal(editado.formaPagamento, 'plantao');
  assert.deepEqual(editado.dias, [{ dia: 10, valorPrevistoCentavos: null }]);

  const { body: lista } = await request(app).get('/equipe').set(ana.auth).expect(200);
  assert.ok(lista.some((m) => m.id === membro.id));
  await request(app).get(`/equipe/${membro.id}`).set(ana.auth).expect(200);
});

test('valida a pessoa: nome único, forma, dias de 1 a 31, sem repetir, pelo menos um', async () => {
  await criarMembro(ana, { nome: 'Única' });
  const repetido = await criarMembro(ana, { nome: 'única' }, 409);
  assert.equal(repetido.erro.codigo, 'MEMBRO_DUPLICADO');
  assert.match((await criarMembro(ana, { nome: 'A', formaPagamento: 'diaria' }, 400)).erro.mensagem, /formaPagamento/);
  assert.match((await criarMembro(ana, { nome: 'B', dias: [] }, 400)).erro.mensagem, /dias/);
  assert.match((await criarMembro(ana, { nome: 'C', dias: [{ dia: 32 }] }, 400)).erro.mensagem, /dias/);
  assert.match((await criarMembro(ana, { nome: 'D', dias: [{ dia: 5 }, { dia: 5 }] }, 400)).erro.mensagem, /dias/);
});

test('pessoa de outro usuário responde 404', async () => {
  const membro = await criarMembro(ana, { nome: 'Só da Ana' });
  await request(app).get(`/equipe/${membro.id}`).set(bia.auth).expect(404);
  await request(app).put(`/equipe/${membro.id}`).set(bia.auth).send(dadosMembro()).expect(404);
  await request(app).delete(`/equipe/${membro.id}`).set(bia.auth).expect(404);
  const { body } = await request(app).get('/equipe').set(bia.auth).expect(200);
  assert.equal(body.length, 0);
});

test('garante as contas do mês atual e do seguinte, sem duplicar e com o valor previsto', async () => {
  const membro = await criarMembro(ana, { nome: 'Rosa', dias: [{ dia: 5, valorPrevistoCentavos: 150000 }, { dia: 31 }] });
  // Data fixa no futuro: o cadastro (desde = hoje) já vale.
  await garantirContas(db, ana.usuario.id, '2999-01-15');
  await garantirContas(db, ana.usuario.id, '2999-01-15');
  const contas = (await contasDe(membro.id)).filter((c) => c.vencimento.startsWith('2999'));
  assert.deepEqual(contas, [
    { vencimento: '2999-01-05', valorCentavos: 150000, status: 'pendente', descricao: 'Rosa' },
    { vencimento: '2999-01-31', valorCentavos: null, status: 'pendente', descricao: 'Rosa' },
    { vencimento: '2999-02-05', valorCentavos: 150000, status: 'pendente', descricao: 'Rosa' },
    { vencimento: '2999-02-28', valorCentavos: null, status: 'pendente', descricao: 'Rosa' },
  ]);
});

test('ao listar contas, as da equipe aparecem a partir de hoje com o nome da pessoa', async () => {
  const sessao = await criarSessao(app);
  const membro = await criarMembro(sessao, { nome: 'Lia', dias: [{ dia: 1 }, { dia: 28 }] });
  const { body } = await request(app).get('/pagamentos').set(sessao.auth).expect(200);
  const daEquipe = body.filter((p) => p.membroId === membro.id);
  assert.deepEqual(
    daEquipe.map((p) => p.vencimento),
    [...esperados(1), ...esperados(28)].sort(),
  );
  const [conta] = daEquipe;
  assert.equal(conta.membroNome, 'Lia');
  assert.equal(conta.descricao, 'Lia');
  assert.equal(conta.valorCentavos, null);
  assert.equal(conta.categoriaId, null);
  assert.equal(conta.categoriaNome, null);
});

test('conta a definir só é paga com o valor; edição muda valor, data e observações', async () => {
  const membro = await criarMembro(ana, { nome: 'Plantonista', formaPagamento: 'plantao', dias: [{ dia: 10 }] });
  await garantirContas(db, ana.usuario.id, '2999-03-01');
  const conta = await db('pagamento').where({ membroId: membro.id, vencimento: '2999-03-10' }).first('id');

  const semValor = await request(app).patch(`/pagamentos/${conta.id}/pagar`).set(ana.auth).send({}).expect(400);
  assert.match(semValor.body.erro.mensagem, /valorCentavos/);

  const { body: editada } = await request(app)
    .put(`/pagamentos/${conta.id}`)
    .set(ana.auth)
    .send({ descricao: 'outra', valorCentavos: 200000, vencimento: '2999-03-11', observacoes: '8 plantões' })
    .expect(200);
  assert.equal(editada.valorCentavos, 200000);
  assert.equal(editada.vencimento, '2999-03-11');
  assert.equal(editada.observacoes, '8 plantões');
  assert.equal(editada.descricao, 'Plantonista', 'a descrição é o nome da pessoa');
  assert.equal(editada.categoriaId, null);

  const { body: paga } = await request(app)
    .patch(`/pagamentos/${conta.id}/pagar`)
    .set(ana.auth)
    .send({ valorCentavos: 210000 })
    .expect(200);
  assert.equal(paga.status, 'pago');
  assert.equal(paga.valorCentavos, 210000);
});

test('conta comum continua exigindo categoria e valor', async () => {
  const [categoria] = (await request(app).get('/categorias-pagamento').set(ana.auth)).body;
  const { body: conta } = await request(app)
    .post('/pagamentos')
    .set(ana.auth)
    .send({ descricao: 'Luz', categoriaId: categoria.id, valorCentavos: 1000, vencimento: '2999-01-10' })
    .expect(201);
  const semCategoria = await request(app)
    .put(`/pagamentos/${conta.id}`)
    .set(ana.auth)
    .send({ descricao: 'Luz', valorCentavos: 1000, vencimento: '2999-01-10' })
    .expect(400);
  assert.match(semCategoria.body.erro.mensagem, /categoriaId/);
  const semValor = await request(app)
    .put(`/pagamentos/${conta.id}`)
    .set(ana.auth)
    .send({ descricao: 'Luz', categoriaId: categoria.id, valorCentavos: null, vencimento: '2999-01-10' })
    .expect(400);
  assert.match(semValor.body.erro.mensagem, /valorCentavos/);
});

test('apagar a conta da equipe não deixa ela voltar naquele dia', async () => {
  const membro = await criarMembro(ana, { nome: 'Dispensada', dias: [{ dia: 7 }] });
  await garantirContas(db, ana.usuario.id, '2999-05-01');
  const conta = await db('pagamento').where({ membroId: membro.id, vencimento: '2999-05-07' }).first('id');
  await request(app).delete(`/pagamentos/${conta.id}`).set(ana.auth).expect(204);
  await garantirContas(db, ana.usuario.id, '2999-05-01');
  assert.equal(await db('pagamento').where({ membroId: membro.id, vencimento: '2999-05-07' }).first('id'), undefined);
});

test('mudar dias ou valores refaz as contas futuras pendentes', async () => {
  const sessao = await criarSessao(app);
  const membro = await criarMembro(sessao, { nome: 'Bete', dias: [{ dia: 28, valorPrevistoCentavos: 1000 }] });
  await request(app).get('/pagamentos').set(sessao.auth).expect(200);
  await request(app)
    .put(`/equipe/${membro.id}`)
    .set(sessao.auth)
    .send(dadosMembro({ nome: 'Bete', dias: [{ dia: 28, valorPrevistoCentavos: 2000 }, { dia: 1 }] }))
    .expect(200);
  await request(app).get('/pagamentos').set(sessao.auth).expect(200);
  const contas = await contasDe(membro.id);
  assert.deepEqual(
    contas.map((c) => [c.vencimento, c.valorCentavos]),
    [...esperados(28).map((d) => [d, 2000]), ...esperados(1).map((d) => [d, null])].sort((a, b) =>
      a[0].localeCompare(b[0]),
    ),
  );
});

test('desativar apaga as futuras pendentes e mantém vencidas e pagas', async () => {
  const sessao = await criarSessao(app);
  const membro = await criarMembro(sessao, { nome: 'Saiu', dias: [{ dia: 28 }] });
  await db('pagamento').insert([
    { usuarioId: sessao.usuario.id, membroId: membro.id, descricao: 'Saiu', vencimento: '2020-01-28' },
    {
      usuarioId: sessao.usuario.id,
      membroId: membro.id,
      descricao: 'Saiu',
      vencimento: '2020-02-28',
      valorCentavos: 5000,
      status: 'pago',
      dataPagamento: '2020-02-28',
    },
  ]);
  await request(app).get('/pagamentos').set(sessao.auth).expect(200);
  const { body } = await request(app)
    .put(`/equipe/${membro.id}`)
    .set(sessao.auth)
    .send(dadosMembro({ nome: 'Saiu', ativo: false, dias: [{ dia: 28 }] }))
    .expect(200);
  assert.equal(body.ativo, false);
  await request(app).get('/pagamentos').set(sessao.auth).expect(200);
  assert.deepEqual(
    (await contasDe(membro.id)).map((c) => c.vencimento),
    ['2020-01-28', '2020-02-28'],
  );

  const excluir = await request(app).delete(`/equipe/${membro.id}`).set(sessao.auth).expect(409);
  assert.equal(excluir.body.erro.codigo, 'REFERENCIA_INVALIDA');
});

test('excluir pessoa que nunca recebeu leva as contas dela', async () => {
  const membro = await criarMembro(ana, { nome: 'Excluir' });
  await request(app).get('/pagamentos').set(ana.auth).expect(200);
  await request(app).delete(`/equipe/${membro.id}`).set(ana.auth).expect(204);
  assert.deepEqual(await contasDe(membro.id), []);
  await request(app).get(`/equipe/${membro.id}`).set(ana.auth).expect(404);
});

test('relatório por categoria junta a equipe em "Salários equipe"', async () => {
  const sessao = await criarSessao(app);
  const membro = await criarMembro(sessao, { nome: 'Relatório', dias: [{ dia: 3, valorPrevistoCentavos: 4000 }, { dia: 9 }] });
  await garantirContas(db, sessao.usuario.id, '2999-06-01');
  const { body } = await request(app)
    .get('/relatorios/gastos')
    .query({ inicio: '2999-06-01', fim: '2999-06-30', agruparPor: 'categoria' })
    .set(sessao.auth)
    .expect(200);
  assert.deepEqual(body.itens, [{ id: null, nome: 'Salários equipe', pagoCentavos: 0, previstoCentavos: 4000 }]);
  assert.ok(membro.id);
});

test('abrir telas não grava: listar contas, Hoje e relatórios não criam conta da equipe; a manutenção cria', async () => {
  const { garantirContasDeTodos } = require('../src/modules/equipe/contas');
  const sessao = await criarSessao(app);
  const membro = await criarMembro(sessao, { nome: 'Dora', dias: [{ dia: 10, valorPrevistoCentavos: 90000 }] });
  // Simula a virada do mês: as contas que o cadastro criou ainda não existem.
  await db('pagamento').where({ membroId: membro.id }).del();

  const mes = DateTime.fromISO(hoje()).toFormat('yyyy-MM');
  const periodo = { inicio: `${mes}-01`, fim: DateTime.fromISO(hoje()).endOf('month').toISODate() };
  await request(app).get('/pagamentos').set(sessao.auth).expect(200);
  await request(app).get('/hoje').set(sessao.auth).expect(200);
  await request(app).get('/relatorios/financeiro').query(periodo).set(sessao.auth).expect(200);
  await request(app).get('/relatorios/gastos').query({ ...periodo, agruparPor: 'categoria' }).set(sessao.auth).expect(200);
  assert.equal((await contasDe(membro.id)).length, 0, 'nenhuma tela criou conta');

  // Conta do mês atual só se o dia 10 ainda não passou desde o cadastro; a do mês seguinte sempre.
  await garantirContasDeTodos(db);
  const criadas = (await contasDe(membro.id)).length;
  assert.ok(criadas >= 1, 'a manutenção cria as contas');
  await garantirContasDeTodos(db);
  assert.equal((await contasDe(membro.id)).length, criadas, 'rodar de novo não duplica');
});
