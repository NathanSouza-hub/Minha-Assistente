// Comprovantes (foto ou PDF) anexados a uma conta, como os anexos de viagem.
const { criarTabela } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'pagamento_comprovante', (t) => {
    t.uuid('pagamento_id').notNullable().references('id').inTable('pagamento').onDelete('CASCADE');
    t.text('nome_original').notNullable();
    t.text('caminho').notNullable();
    t.text('mime_type').notNullable();
    t.integer('tamanho_bytes').notNullable();
    t.index(['pagamento_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('pagamento_comprovante');
};
