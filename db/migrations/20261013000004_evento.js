const { criarTabela, checkIn, check } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'evento', (t) => {
    t.text('titulo').notNullable();
    t.text('tipo').notNullable();
    t.text('modalidade').nullable();
    t.timestamp('inicio', { useTz: true }).notNullable();
    t.timestamp('fim', { useTz: true }).nullable();
    t.text('local').nullable();
    t.text('link').nullable();
    t.text('observacoes').nullable();
    t.text('recorrencia').notNullable().defaultTo('nenhuma');
    t.date('recorrencia_fim').nullable();
    t.specificType('lembretes_minutos_antes', 'integer[]').notNullable().defaultTo('{}');

    t.index(['inicio']);
    t.index(['tipo', 'inicio']);
  });

  await knex.raw(
    "CREATE INDEX evento_recorrentes_idx ON evento (inicio) WHERE recorrencia <> 'nenhuma'",
  );

  await checkIn(knex, 'evento', 'tipo', [
    'reuniao_pessoal',
    'exame',
    'consulta',
    'video',
    'programa_radio',
    'fisioterapia',
    'atividade_fisica',
  ]);
  await checkIn(knex, 'evento', 'modalidade', [
    'presencial',
    'telemedicina',
    'videoconferencia',
    'podcast',
    'gravacao',
  ]);
  await checkIn(knex, 'evento', 'recorrencia', ['nenhuma', 'diaria', 'semanal', 'mensal', 'anual']);
  await check(knex, 'evento', 'fim_depois_inicio', 'fim IS NULL OR fim > inicio');
  await check(
    knex,
    'evento',
    'lembretes',
    'cardinality(lembretes_minutos_antes) <= 5 AND 0 < ALL(lembretes_minutos_antes)',
  );
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('evento');
};
