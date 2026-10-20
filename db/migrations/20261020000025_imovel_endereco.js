// Imóvel ganha endereço e uma identificação complementar (ex.: "Apto 302", "Matrícula 12.345"),
// ambos opcionais: os imóveis cadastrados continuam como estão. Decisão 27.
exports.up = async (knex) => {
  await knex.schema.alterTable('imovel', (t) => {
    t.text('endereco').nullable();
    t.text('complemento').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('imovel', (t) => {
    t.dropColumn('complemento');
    t.dropColumn('endereco');
  });
};
