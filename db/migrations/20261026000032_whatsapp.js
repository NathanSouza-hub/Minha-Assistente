// Lembretes também pelo WhatsApp (decisão 38): o número de cada pessoa (só dígitos, com o código do
// país: "5511987654321"; nulo = não recebe) e o canal "whatsapp" em lembrete_envio.
const { check, checkIn } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.alterTable('usuario', (t) => {
    t.text('whatsapp').nullable();
  });
  await check(knex, 'usuario', 'whatsapp', "whatsapp ~ '^[1-9][0-9]{9,14}$'");
  await knex.raw('ALTER TABLE lembrete_envio DROP CONSTRAINT lembrete_envio_canal_check');
  await checkIn(knex, 'lembrete_envio', 'canal', ['app', 'whatsapp']);
};

exports.down = async (knex) => {
  await knex('lembrete_envio').where({ canal: 'whatsapp' }).del();
  await knex.raw('ALTER TABLE lembrete_envio DROP CONSTRAINT lembrete_envio_canal_check');
  await checkIn(knex, 'lembrete_envio', 'canal', ['app']);
  await knex.schema.alterTable('usuario', (t) => {
    t.dropColumn('whatsapp');
  });
};
