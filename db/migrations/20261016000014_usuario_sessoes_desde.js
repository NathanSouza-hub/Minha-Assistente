// Trocar a senha encerra as sessões abertas em outros aparelhos: tokens emitidos antes de
// `sessoes_desde` são recusados (o JWT não tem como ser revogado de outro jeito).

exports.up = async (knex) => {
  await knex.schema.alterTable('usuario', (t) => {
    t.timestamp('sessoes_desde', { useTz: true }).nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('usuario', (t) => {
    t.dropColumn('sessoes_desde');
  });
};
