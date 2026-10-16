// Resumo da manhã: um aviso por dia com o que há para hoje (gerador src/lembretes/geradores/resumo.js).
// Vem ligado às 07:00; a pessoa muda o horário ou desliga em Notificações.
const { checkIn } = require('../helpers');

const ORIGENS = ['evento', 'medicamento_horario', 'pagamento', 'rotina'];

exports.up = async (knex) => {
  await knex.schema.alterTable('usuario', (t) => {
    t.boolean('resumo_ativo').notNullable().defaultTo(true);
    t.time('resumo_hora').notNullable().defaultTo('07:00');
  });
  await knex.raw('ALTER TABLE lembrete_envio DROP CONSTRAINT lembrete_envio_origem_tipo_check');
  await checkIn(knex, 'lembrete_envio', 'origem_tipo', [...ORIGENS, 'resumo']);
};

exports.down = async (knex) => {
  await knex('lembrete_envio').where({ origem_tipo: 'resumo' }).del();
  await knex.raw('ALTER TABLE lembrete_envio DROP CONSTRAINT lembrete_envio_origem_tipo_check');
  await checkIn(knex, 'lembrete_envio', 'origem_tipo', ORIGENS);
  await knex.schema.alterTable('usuario', (t) => {
    t.dropColumn('resumo_hora');
    t.dropColumn('resumo_ativo');
  });
};
