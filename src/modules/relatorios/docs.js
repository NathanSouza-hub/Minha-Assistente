const { filtrosGastos, relatorioGastos, filtrosFinanceiro, relatorioFinanceiro } = require('./schema');
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
    '/relatorios/financeiro': {
      get: {
        tags: ['Relatórios'],
        summary: 'Visão financeira do período: despesas, por imóvel e pessoais',
        description: [
          '**Contas do período** = `vencimento` no período (pagas ou não), em pago, pendente e',
          'vencido (pendente com vencimento antes de hoje). **Realizado** (`pagoNoPeriodoCentavos`) =',
          'pagas com `dataPagamento` no período, de qualquer vencimento. Pessoal = contas sem imóvel',
          '(faturas de cartão e equipe incluídas); soma dos imóveis + pessoal = total.',
        ].join(' '),
        parameters: parametrosQuery(filtrosFinanceiro),
        responses: {
          200: respostaJson('Relatório financeiro', relatorioFinanceiro),
          ...respostasErro({ 400: 'Parâmetros inválidos (VALIDACAO)', ...ERRO_AUTH }),
        },
      },
    },
  },
};
