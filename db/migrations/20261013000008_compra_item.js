const { criarTabela, check } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'compra_item', (t) => {
    t.text('nome').notNullable();
    t.text('categoria').nullable();
    t.text('quantidade').nullable();
    t.boolean('comprado').notNullable().defaultTo(false);
    t.timestamp('comprado_em', { useTz: true }).nullable();
    t.index(['comprado']);
  });

  await check(knex, 'compra_item', 'comprado_tem_data', 'comprado = (comprado_em IS NOT NULL)');
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('compra_item');
};
