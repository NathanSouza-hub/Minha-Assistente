// Comprovantes (foto ou PDF) de uma conta. Regras em src/lib/comprovantes.js.
const { MAXIMO_COMPROVANTES, criarComprovantes } = require('../../lib/comprovantes');

const { listar, adicionar, abrir, remover, aoApagar } = criarComprovantes({
  tabela: 'pagamentoComprovante',
  pai: 'pagamento',
  chave: 'pagamentoId',
  recurso: 'Pagamento',
  registro: 'conta',
});

module.exports = { MAXIMO_COMPROVANTES, listar, adicionar, abrir, remover, aoApagarContas: aoApagar };
