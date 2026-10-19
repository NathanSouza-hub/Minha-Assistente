// Categorias com que toda conta nova começa. Depois o usuário cria, renomeia e apaga as suas.
// Salários e honorários ficam na aba "Salários equipe" (módulo equipe), não em categorias;
// consultas, exames e parcelamentos não têm aba (migration 22).
const CATEGORIAS_PADRAO = [
  'Contas residenciais',
  'Outros',
];

const criarPadrao = (conexao, usuarioId) =>
  conexao('categoriaPagamento').insert(
    CATEGORIAS_PADRAO.map((nome, i) => ({ usuarioId, nome, ordem: i + 1 })),
  );

module.exports = { CATEGORIAS_PADRAO, criarPadrao };
