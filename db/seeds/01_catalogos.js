// Imóveis e categorias de pagamento. Idempotente: rodar de novo só atualiza a ordem.

const IMOVEIS = ['Apartamento cobertura', 'Apartamento 15º andar', 'Casa da Serra'];

const CATEGORIAS = [
  'Salários',
  'Honorários médicos',
  'Consultas',
  'Exames',
  'Parcelamentos',
  'Contas residenciais',
];

const comOrdem = (nomes) => nomes.map((nome, i) => ({ nome, ordem: i + 1 }));

exports.seed = async (knex) => {
  await knex('imovel').insert(comOrdem(IMOVEIS)).onConflict('nome').merge(['ordem']);
  await knex('categoria_pagamento').insert(comOrdem(CATEGORIAS)).onConflict('nome').merge(['ordem']);
};
