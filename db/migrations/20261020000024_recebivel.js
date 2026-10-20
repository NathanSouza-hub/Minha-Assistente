// Recebíveis (valores a receber: dividendos, aluguéis, rendimentos, honorários...), o histórico de
// recebimentos de cada um (recebimento parcial ou total) e os comprovantes. Decisão 26.
const { criarTabela, donoUsuario, checkIn, check } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'recebivel', (t) => {
    donoUsuario(t);
    t.text('descricao').notNullable();
    t.text('origem').notNullable();
    t.bigInteger('valor_previsto_centavos').notNullable();
    t.date('data_prevista').notNullable();
    // Dado por recebido mesmo com menos que o previsto (ex.: dividendo menor que o esperado).
    t.boolean('encerrado').notNullable().defaultTo(false);
    t.text('recorrencia').notNullable().defaultTo('nenhuma');
    t.uuid('recorrencia_origem_id').nullable().references('id').inTable('recebivel').onDelete('SET NULL');
    t.text('observacoes').nullable();
    t.index(['usuario_id', 'data_prevista']);
  });
  await checkIn(knex, 'recebivel', 'origem', ['dividendos', 'aluguel', 'rendimentos', 'honorarios', 'outros']);
  await checkIn(knex, 'recebivel', 'recorrencia', ['nenhuma', 'mensal', 'anual']);
  await check(knex, 'recebivel', 'valor_previsto', 'valor_previsto_centavos > 0');
  // Uma série recorrente nunca ganha duas "próximas".
  await knex.raw(
    'CREATE UNIQUE INDEX recebivel_recorrencia_origem_unica ON recebivel (recorrencia_origem_id) WHERE recorrencia_origem_id IS NOT NULL',
  );

  await criarTabela(knex, 'recebimento', (t) => {
    t.uuid('recebivel_id').notNullable().references('id').inTable('recebivel').onDelete('CASCADE');
    t.bigInteger('valor_centavos').notNullable();
    t.date('data').notNullable();
    t.text('observacoes').nullable();
    t.index(['recebivel_id', 'data']);
  });
  await check(knex, 'recebimento', 'valor', 'valor_centavos > 0');

  await criarTabela(knex, 'recebivel_comprovante', (t) => {
    t.uuid('recebivel_id').notNullable().references('id').inTable('recebivel').onDelete('CASCADE');
    t.text('nome_original').notNullable();
    t.text('caminho').notNullable();
    t.text('mime_type').notNullable();
    t.integer('tamanho_bytes').notNullable();
    t.index(['recebivel_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('recebivel_comprovante');
  await knex.schema.dropTableIfExists('recebimento');
  await knex.schema.dropTableIfExists('recebivel');
};
