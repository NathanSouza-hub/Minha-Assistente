// Troca `sessoes_desde` (comparar horários de dois relógios ao segundo deixava uma janela) por
// um número de versão: o token leva a versão em que foi emitido e trocar a senha a incrementa.

exports.up = async (knex) => {
  await knex.schema.alterTable('usuario', (t) => {
    t.integer('versao_sessao').notNullable().defaultTo(0);
    t.dropColumn('sessoes_desde');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('usuario', (t) => {
    t.timestamp('sessoes_desde', { useTz: true }).nullable();
    t.dropColumn('versao_sessao');
  });
};
