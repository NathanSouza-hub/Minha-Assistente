const { filtrosGastos, relatorioGastos } = require('./schema');
const { respostaJson, respostasErro, parametrosQuery, ERRO_AUTH } = require('../../docs/helpers');

module.exports = {
  paths: {
    '/relatorios/gastos': {
      get: {
        tags: ['Relatórios'],
        summary: 'Gastos por imóvel ou categoria num período',
        description: [
          '**Pago**: pagamentos pagos com `dataPagamento` no período.',
          '**Previsto**: pendentes com `vencimento` no período.',
          'Só aparecem grupos com algum valor. Por imóvel, pagamentos sem imóvel vêm em',
          '`{ id: null, nome: "Sem imóvel" }`.',
        ].join(' '),
        parameters: parametrosQuery(filtrosGastos),
        responses: {
          200: respostaJson('Relatório', relatorioGastos),
          ...respostasErro({ 400: 'Parâmetros inválidos (VALIDACAO)', ...ERRO_AUTH }),
        },
      },
    },
  },
};
