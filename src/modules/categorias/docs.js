const { z } = require('../../lib/zod');
const { categoria } = require('./schema');
const { respostaJson, respostasErro, ERRO_AUTH } = require('../../docs/helpers');

module.exports = {
  paths: {
    '/categorias-pagamento': {
      get: {
        tags: ['Pagamentos'],
        summary: 'Categorias de pagamento (fixas, iguais para todos)',
        responses: {
          200: respostaJson('Categorias em ordem de exibição', z.array(categoria)),
          ...respostasErro(ERRO_AUTH),
        },
      },
    },
  },
};
