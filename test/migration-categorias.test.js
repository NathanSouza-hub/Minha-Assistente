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
