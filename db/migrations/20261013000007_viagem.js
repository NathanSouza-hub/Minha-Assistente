const { criarTabela, check, donoUsuario } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'viagem', (t) => {
    donoUsuario(t);
    t.text('destino').notNullable();
    t.date('ida').notNullable();
    t.date('volta').nullable();
    t.text('hospedagem').nullable();
    t.text('transporte').nullable();
    t.text('observacoes').nullable();
    t.index(['usuario_id', 'ida']);
  });

  await check(knex, 'viagem', 'volta_depois_ida', 'volta IS NULL OR volta >= ida');

  await criarTabela(knex, 'viagem_anexo', (t) => {
    t.uuid('viagem_id').notNullable().references('id').inTable('viagem').onDelete('CASCADE');
    t.text('nome_original').notNullable();
    t.text('caminho').notNullable();
    t.text('mime_type').notNullable();
    t.integer('tamanho_bytes').notNullable();
    t.index(['viagem_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('viagem_anexo');
  await knex.schema.dropTableIfExists('viagem');
};
