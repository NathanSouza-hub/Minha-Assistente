// Categorias com que toda conta nova começa. Depois o usuário cria, renomeia e apaga as suas.
// Salários e honorários ficam na aba "Salários equipe" (módulo equipe), não em categorias;
// consultas, exames e parcelamentos não têm aba (migration 22). A migration 35 acrescentou as do
// meio para quem já tinha conta (a assistente do WhatsApp escolhe entre elas).
const CATEGORIAS_PADRAO = [
  'Contas residenciais',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Casa',
  'Contas fixas',
  'Lazer',
  'Outros',
];

const criarPadrao = (conexao, usuarioId) =>
  conexao('categoriaPagamento').insert(
    CATEGORIAS_PADRAO.map((nome, i) => ({ usuarioId, nome, ordem: i + 1 })),
  );

module.exports = { CATEGORIAS_PADRAO, criarPadrao };
