const { filtro, painel, DIAS_A_VENCER } = require('./schema');
const { respostaJson, respostasErro, parametrosQuery, ERRO_AUTH } = require('../../docs/helpers');

module.exports = {
  paths: {
    '/hoje': {
      get: {
        tags: ['Hoje'],
        summary: 'Painel do dia',
        description: [
          'Eventos do dia (recorrentes expandidos), remédios com status de tomado, rotina com status',
          `de concluída, pagamentos pendentes vencidos e que vencem em até ${DIAS_A_VENCER} dias.`,
          '`resumo` traz as contagens para indicadores. Cada lista segue o mesmo formato do seu módulo.',
        ].join(' '),
        parameters: parametrosQuery(filtro),
        responses: {
          200: respostaJson('Painel', painel),
          ...respostasErro({ 400: 'Data inválida (VALIDACAO)', ...ERRO_AUTH }),
        },
      },
    },
  },
};
