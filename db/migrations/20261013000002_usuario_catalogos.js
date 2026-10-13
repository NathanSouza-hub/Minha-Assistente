const { criarTabela, donoUsuario } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'usuario', (t) => {
    t.text('nome').notNullable();
    t.specificType('email', 'citext').notNullable().unique();
    t.text('senha_hash').notNullable();
  });

  // Cada usuário cadastra os próprios imóveis.
  await criarTabela(knex, 'imovel', (t) => {
    donoUsuario(t);
    t.text('nome').notNullable();
    t.smallint('ordem').notNullable().defaultTo(0);
    t.unique(['usuario_id', 'nome']);
    // Alvo da FK composta de pagamento: garante imóvel do mesmo dono.
    t.unique(['id', 'usuario_id']);
  });

  // Categorias são globais (seed).
  await criarTabela(knex, 'categoria_pagamento', (t) => {
    t.text('nome').notNullable().unique();
    t.smallint('ordem').notNullable().defaultTo(0);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('categoria_pagamento');
  await knex.schema.dropTableIfExists('imovel');
  await knex.schema.dropTableIfExists('usuario');
};
