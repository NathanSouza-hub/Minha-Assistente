// Categorias de pagamento (globais). Idempotente: rodar de novo só atualiza a ordem.
// Imóveis não entram aqui: cada usuário cadastra os seus.

const CATEGORIAS = [
  'Salários',
  'Honorários médicos',
  'Consultas',
  'Exames',
  'Parcelamentos',
  'Contas residenciais',
];

exports.seed = async (knex) => {
  const linhas = CATEGORIAS.map((nome, i) => ({ nome, ordem: i + 1 }));
  await knex('categoria_pagamento').insert(linhas).onConflict('nome').merge(['ordem']);
};
