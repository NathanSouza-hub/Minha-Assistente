// Valores em centavos passam de integer (teto de R$ 21,4 milhões) para bigint: o sistema não deve
// impor limite aos valores financeiros. Só alarga o tipo; os dados ficam como estão.
const COLUNAS = [
  ['pagamento', 'valor_centavos'],
  ['cartao', 'limite_centavos'],
  ['cartao_compra', 'valor_total_centavos'],
  ['membro_equipe_dia', 'valor_previsto_centavos'],
];

exports.up = async (knex) => {
  for (const [tabela, coluna] of COLUNAS) {
    await knex.raw('ALTER TABLE ?? ALTER COLUMN ?? TYPE bigint', [tabela, coluna]);
  }
};

// Não volta para integer: um valor acima do teto antigo não caberia e a volta falharia (ou perderia
// o dado). bigint aceita tudo que integer aceitava, então desfazer as migrations seguintes continua ok.
exports.down = async () => {};
