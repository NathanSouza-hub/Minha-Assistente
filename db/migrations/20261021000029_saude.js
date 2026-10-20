// Saúde: período de uso do remédio (início e fim, opcionais: sem eles vale todo dia, como antes) e o
// intervalo "a cada N horas" com que os horários foram montados (só registro: o back-end não gera nem
// muda horários). Consultas, exames e fisioterapia ganham profissional e especialidade. Decisão 31.
const { check } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.alterTable('medicamento', (t) => {
    t.date('data_inicio').nullable();
    t.date('data_fim').nullable();
    t.smallint('intervalo_horas').nullable();
  });
  await check(knex, 'medicamento', 'periodo', 'data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio');
  await check(knex, 'medicamento', 'intervalo_horas', 'intervalo_horas IS NULL OR intervalo_horas BETWEEN 1 AND 24');

  await knex.schema.alterTable('evento', (t) => {
    t.text('profissional').nullable();
    t.text('especialidade').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('evento', (t) => {
    t.dropColumn('profissional');
    t.dropColumn('especialidade');
  });
  await knex.schema.alterTable('medicamento', (t) => {
    t.dropColumn('data_inicio');
    t.dropColumn('data_fim');
    t.dropColumn('intervalo_horas');
  });
};
