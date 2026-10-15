// Categorias com que toda conta nova começa. Depois o usuário cria, renomeia e apaga as suas.
const CATEGORIAS_PADRAO = [
  'Salários',
  'Honorários médicos',
  'Consultas',
  'Exames',
  'Parcelamentos',
  'Contas residenciais',
];

const criarPadrao = (conexao, usuarioId) =>
  conexao('categoriaPagamento').insert(
    CATEGORIAS_PADRAO.map((nome, i) => ({ usuarioId, nome, ordem: i + 1 })),
  );

module.exports = { CATEGORIAS_PADRAO, criarPadrao };
