// Um evento pode ter vários lembretes para a mesma ocorrência (ex.: na véspera e 2h antes), e um
// pagamento é lembrado na véspera e no dia. O único passa a incluir o horário de envio.
exports.up = async (knex) => {
  await knex.schema.alterTable('lembrete_envio', (t) => {
    t.dropUnique(['origem_tipo', 'origem_id', 'ocorrencia', 'canal']);
    t.unique(['origem_tipo', 'origem_id', 'ocorrencia', 'agendado_para', 'canal']);
  });
};

exports.down = async (knex) => {
  await knex('lembrete_envio').del();
  await knex.schema.alterTable('lembrete_envio', (t) => {
    t.dropUnique(['origem_tipo', 'origem_id', 'ocorrencia', 'agendado_para', 'canal']);
    t.unique(['origem_tipo', 'origem_id', 'ocorrencia', 'canal']);
  });
};
