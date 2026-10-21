// Compromissos (lembretes que repetem) ganham observações, como os lembretes do dia. Decisão 32.
exports.up = async (knex) => {
  await knex.schema.alterTable('rotina', (t) => {
    t.text('observacoes').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('rotina', (t) => {
    t.dropColumn('observacoes');
  });
};
