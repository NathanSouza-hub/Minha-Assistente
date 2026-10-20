// Notificações por categoria: as que a pessoa desligou (agenda, remédios, contas, compromissos,
// tarefas). Vazio = tudo ligado, como era antes. Decisão 29.
exports.up = async (knex) => {
  await knex.schema.alterTable('usuario', (t) => {
    t.specificType('avisos_desligados', 'text[]').notNullable().defaultTo('{}');
  });
  await knex.raw(`
    ALTER TABLE usuario ADD CONSTRAINT usuario_avisos_desligados_check
    CHECK (avisos_desligados <@ ARRAY['agenda', 'remedios', 'contas', 'compromissos', 'tarefas']::text[])
  `);
};

exports.down = async (knex) => {
  await knex.schema.alterTable('usuario', (t) => {
    t.dropColumn('avisos_desligados');
  });
};
