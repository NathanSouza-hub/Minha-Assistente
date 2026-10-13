const { criarTabela, checkIn, check, donoUsuario } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'medicamento', (t) => {
    donoUsuario(t);
    t.index(['usuario_id']);
    t.text('nome').notNullable();
    t.text('dose').nullable();
    t.text('observacoes').nullable();
    t.boolean('ativo').notNullable().defaultTo(true);
  });

  await criarTabela(knex, 'medicamento_horario', (t) => {
    t.uuid('medicamento_id').notNullable().references('id').inTable('medicamento').onDelete('CASCADE');
    t.text('periodo').notNullable();
    t.time('hora').nullable();
    t.smallint('dia_semana').nullable();
    t.index(['medicamento_id']);
  });

  await checkIn(knex, 'medicamento_horario', 'periodo', ['manha', 'tarde', 'noite', 'semanal']);
  await check(
    knex,
    'medicamento_horario',
    'dia_semana',
    "(dia_semana IS NULL OR dia_semana BETWEEN 0 AND 6) AND (periodo <> 'semanal' OR dia_semana IS NOT NULL)",
  );

  await criarTabela(knex, 'medicamento_registro', (t) => {
    t.uuid('medicamento_horario_id')
      .notNullable()
      .references('id')
      .inTable('medicamento_horario')
      .onDelete('CASCADE');
    t.date('data').notNullable();
    t.timestamp('tomado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['medicamento_horario_id', 'data']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('medicamento_registro');
  await knex.schema.dropTableIfExists('medicamento_horario');
  await knex.schema.dropTableIfExists('medicamento');
};
