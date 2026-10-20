// Comprovantes (foto ou PDF) de um recebível. Regras em src/lib/comprovantes.js.
const { MAXIMO_COMPROVANTES, criarComprovantes } = require('../../lib/comprovantes');

module.exports = {
  MAXIMO_COMPROVANTES,
  ...criarComprovantes({
    tabela: 'recebivelComprovante',
    pai: 'recebivel',
    chave: 'recebivelId',
    recurso: 'Recebível',
    registro: 'recebível',
  }),
};
