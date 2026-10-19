require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { prepararBanco } = require('./helpers/banco');

const MIGRATION = '20261014000012_categoria_por_usuario.js';

before(async () => {
  await prepararBanco(db);
});

after(async () => {
  await db.destroy();
});

const criarUsuario = async (email) => {
  const [usuario] = await db('usuario').insert({ nome: 'Teste', email, senhaHash: 'x' }).returning('id');
  return usuario.id;
};

const conta = (usuarioId, categoriaId, descricao) => ({
  usuarioId,
  categoriaId,
  descricao,
  valorCentavos: 1000,
  vencimento: '2026-10-20',
});

const categoriaDaConta = (descricao, colunas = ['c.nome', 'c.usuarioId']) =>
  db('pagamento as p')
    .join('categoriaPagamento as c', 'c.id', 'p.categoriaId')
    .where('p.descricao', descricao)
    .first(colunas);

test('categorias globais viram cópias por usuário sem perder as contas', async () => {
  const ana = await criarUsuario('ana-migracao@exemplo.com');
  const bia = await criarUsuario('bia-migracao@exemplo.com');

  // Volta ao formato antigo: categorias globais, contas apontando para elas.
  await db.migrate.down({ name: MIGRATION });
  const globais = await db('categoriaPagamento')
    .insert([
      { nome: 'Salários', ordem: 1 },
      { nome: 'Contas residenciais', ordem: 2 },
    ])
    .returning(['id', 'nome']);
  const id = (nome) => globais.find((c) => c.nome === nome).id;
  await db('pagamento').insert([
    conta(ana, id('Salários'), 'Salário da Ana'),
    conta(ana, id('Contas residenciais'), 'Luz da Ana'),
    conta(bia, id('Salários'), 'Salário da Bia'),
  ]);

  await db.migrate.up({ name: MIGRATION });

  for (const usuarioId of [ana, bia]) {
    const nomes = await db('categoriaPagamento').where({ usuarioId }).orderBy('ordem').pluck('nome');
    assert.deepEqual(nomes, ['Salários', 'Contas residenciais']);
  }
  assert.equal((await db('categoriaPagamento').whereNull('usuarioId').count('* as n'))[0].n, 0);
  assert.deepEqual(await categoriaDaConta('Salário da Ana'), { nome: 'Salários', usuarioId: ana });
  assert.deepEqual(await categoriaDaConta('Luz da Ana'), { nome: 'Contas residenciais', usuarioId: ana });
  assert.deepEqual(await categoriaDaConta('Salário da Bia'), { nome: 'Salários', usuarioId: bia });

  // Desfazer volta às globais, com as contas apontando para elas.
  await db.migrate.down({ name: MIGRATION });
  const depois = await db('categoriaPagamento').orderBy('ordem').pluck('nome');
  assert.deepEqual(depois, ['Salários', 'Contas residenciais']);
  assert.equal((await categoriaDaConta('Salário da Bia', ['c.nome'])).nome, 'Salários');

  await db.migrate.latest();
});

test('conta não pode usar categoria de outro usuário', async () => {
  const ana = await criarUsuario('ana-fk@exemplo.com');
  const bia = await criarUsuario('bia-fk@exemplo.com');
  const [daBia] = await db('categoriaPagamento').insert({ usuarioId: bia, nome: 'Da Bia' }).returning('id');
  await assert.rejects(db('pagamento').insert(conta(ana, daBia.id, 'Inválida')), { code: '23503' });
});

test('nome de categoria é único por usuário sem diferenciar maiúsculas', async () => {
  const ana = await criarUsuario('ana-unica@exemplo.com');
  const bia = await criarUsuario('bia-unica@exemplo.com');
  await db('categoriaPagamento').insert({ usuarioId: ana, nome: 'Plano de saúde' });
  await assert.rejects(db('categoriaPagamento').insert({ usuarioId: ana, nome: 'PLANO DE SAÚDE' }), {
    code: '23505',
  });
  await db('categoriaPagamento').insert({ usuarioId: bia, nome: 'Plano de saúde' });
});

test('"Salários" e "Honorários médicos" somem e as contas delas vão para "Outros"', async () => {
  const REMOVER = '20261016000020_remover_salarios_honorarios.js';
  const ana = await criarUsuario('ana-equipe@exemplo.com');
  const bia = await criarUsuario('bia-equipe@exemplo.com');
  await db.migrate.down({ name: REMOVER });
  // Ana tem "Outros"; Bia apagou a dela e tem uma conta em "Honorários médicos".
  const [salariosAna, outrosAna] = await db('categoriaPagamento')
    .insert([
      { usuarioId: ana, nome: 'Salários', ordem: 1 },
      { usuarioId: ana, nome: 'Outros', ordem: 2 },
      { usuarioId: ana, nome: 'Honorários médicos', ordem: 3 },
    ])
    .returning('id');
  const [honorariosBia] = await db('categoriaPagamento')
    .insert([
      { usuarioId: bia, nome: 'Honorários médicos', ordem: 1 },
      { usuarioId: bia, nome: 'Exames', ordem: 2 },
    ])
    .returning('id');
  await db('pagamento').insert([
    conta(ana, salariosAna.id, 'Salário antigo da Ana'),
    conta(bia, honorariosBia.id, 'Honorário antigo da Bia'),
  ]);

  await db.migrate.up({ name: REMOVER });

  const nomes = (usuarioId) => db('categoriaPagamento').where({ usuarioId }).orderBy('ordem').pluck('nome');
  assert.deepEqual(await nomes(ana), ['Outros']);
  assert.deepEqual(await nomes(bia), ['Exames', 'Outros']);
  assert.equal((await categoriaDaConta('Salário antigo da Ana', ['c.id'])).id, outrosAna.id);
  assert.deepEqual(await categoriaDaConta('Honorário antigo da Bia'), { nome: 'Outros', usuarioId: bia });
});

test('"Consultas" e "Exames" somem; contas e compras de cartão delas vão para "Outros"', async () => {
  const REMOVER = '20261019000022_remover_consultas_exames.js';
  const caio = await criarUsuario('caio-consultas@exemplo.com');
  const davi = await criarUsuario('davi-consultas@exemplo.com');
  const eva = await criarUsuario('eva-consultas@exemplo.com');
  await db.migrate.down({ name: REMOVER });
  // Caio tem "Outros"; Davi apagou a dele e tem uma compra de cartão em "Exames"; Eva apagou e
  // não tem nada nessas categorias (não ganha "Outros").
  const [consultasCaio, outrosCaio] = await db('categoriaPagamento')
    .insert([
      { usuarioId: caio, nome: 'Consultas', ordem: 1 },
      { usuarioId: caio, nome: 'Outros', ordem: 2 },
      { usuarioId: caio, nome: 'Exames', ordem: 3 },
    ])
    .returning('id');
  const [examesDavi] = await db('categoriaPagamento')
    .insert([
      { usuarioId: davi, nome: 'Exames', ordem: 1 },
      { usuarioId: davi, nome: 'Parcelamentos', ordem: 2 },
    ])
    .returning('id');
  await db('categoriaPagamento').insert({ usuarioId: eva, nome: 'consultas', ordem: 1 });
  await db('pagamento').insert(conta(caio, consultasCaio.id, 'Consulta antiga do Caio'));
  const [cartao] = await db('cartao')
    .insert({ usuarioId: davi, nome: 'Nubank', diaFechamento: 1, diaVencimento: 10 })
    .returning('id');
  await db('cartaoCompra').insert({
    cartaoId: cartao.id,
    descricao: 'Exame de sangue',
    categoriaId: examesDavi.id,
    valorTotalCentavos: 9000,
    dataCompra: '2026-10-05',
  });

  await db.migrate.up({ name: REMOVER });

  const nomes = (usuarioId) => db('categoriaPagamento').where({ usuarioId }).orderBy('ordem').pluck('nome');
  assert.deepEqual(await nomes(caio), ['Outros']);
  assert.deepEqual(await nomes(davi), ['Parcelamentos', 'Outros']);
  assert.deepEqual(await nomes(eva), []);
  assert.equal((await categoriaDaConta('Consulta antiga do Caio', ['c.id'])).id, outrosCaio.id);
  const compra = await db('cartaoCompra as k')
    .join('categoriaPagamento as c', 'c.id', 'k.categoriaId')
    .where('k.descricao', 'Exame de sangue')
    .first('c.nome', 'c.usuarioId');
  assert.deepEqual(compra, { nome: 'Outros', usuarioId: davi });
});
