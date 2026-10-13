const { criarTabela } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'usuario', (t) => {
    t.text('nome').notNullable();
    t.specificType('email', 'citext').notNullable().unique();
    t.text('senha_hash').notNullable();
  });

  await criarTabela(knex, 'imovel', (t) => {
    t.text('nome').notNullable().unique();
    t.smallint('ordem').notNullable().defaultTo(0);
  });

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
