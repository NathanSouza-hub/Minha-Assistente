const { criarTabela, check, donoUsuario } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'rotina', (t) => {
    donoUsuario(t);
    t.index(['usuario_id']);
    t.text('titulo').notNullable();
    t.time('hora').nullable();
    // 0 = domingo ... 6 = sábado
    t.specificType('dias_semana', 'smallint[]').notNullable().defaultTo('{0,1,2,3,4,5,6}');
    t.boolean('ativo').notNullable().defaultTo(true);
    t.smallint('ordem').notNullable().defaultTo(0);
    t.boolean('lembrete').notNullable().defaultTo(false);
  });

  await check(
    knex,
    'rotina',
    'dias_semana',
    "cardinality(dias_semana) > 0 AND dias_semana <@ '{0,1,2,3,4,5,6}'::smallint[]",
  );

  await criarTabela(knex, 'rotina_conclusao', (t) => {
    t.uuid('rotina_id').notNullable().references('id').inTable('rotina').onDelete('CASCADE');
    t.date('data').notNullable();
    t.timestamp('concluida_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['rotina_id', 'data']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('rotina_conclusao');
  await knex.schema.dropTableIfExists('rotina');
};
