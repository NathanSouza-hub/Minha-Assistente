// Cada ocorrência recorrente gera no máximo uma próxima: evita duplicar a série em pagamentos
// simultâneos ou ao pagar, desfazer e pagar de novo.

exports.up = async (knex) => {
  await knex.raw(
    'CREATE UNIQUE INDEX pagamento_recorrencia_origem_unica ON pagamento (recorrencia_origem_id) WHERE recorrencia_origem_id IS NOT NULL',
  );
};

exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS pagamento_recorrencia_origem_unica');
};
