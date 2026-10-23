const {
  filtrosGastos,
  relatorioGastos,
  filtrosFinanceiro,
  relatorioFinanceiro,
  relatorioImovel,
  filtrosProdutividade,
  relatorioProdutividade,
} = require('./schema');
const { respostaJson, respostasErro, parametrosQuery, paramId, ERRO_AUTH } = require('../../docs/helpers');

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
    '/relatorios/produtividade': {
      get: {
        tags: ['Relatórios'],
        summary: 'Quanto foi concluído por dia: tarefas de uma vez e compromissos que repetem',
        description: [
          'Conta só o que foi **concluído de fato**, pelo dia da conclusão (fuso America/Sao_Paulo):',
          '`tarefa.concluida_em` e cada `rotina_conclusao`. Tarefa reaberta ou excluída e conclusões de',
          'compromisso desmarcadas ou excluído não contam (o registro não existe mais); compromisso',
          'pausado conta. Não há previsto, pendente nem taxa: a configuração atual dos compromissos não',
          'reconstrói o passado. Todo dia do período vem na lista, com zeros. Até 366 dias.',
        ].join(' '),
        parameters: parametrosQuery(filtrosProdutividade),
        responses: {
          200: respostaJson('Concluídos por dia', relatorioProdutividade),
          ...respostasErro({ 400: 'Parâmetros inválidos ou período longo demais (VALIDACAO)', ...ERRO_AUTH }),
        },
      },
    },
    '/relatorios/imoveis/{id}': {
      get: {
        tags: ['Relatórios'],
        summary: 'Resumo de um imóvel no período: situação, categorias, mês a mês',
        description: 'Só as contas do imóvel com `vencimento` no período, com os mesmos critérios de /relatorios/financeiro.',
        parameters: [paramId, ...parametrosQuery(filtrosFinanceiro)],
        responses: {
          200: respostaJson('Resumo do imóvel', relatorioImovel),
          ...respostasErro({ 400: 'Parâmetros inválidos (VALIDACAO)', ...ERRO_AUTH, 404: 'Imóvel não encontrado (NAO_ENCONTRADO)' }),
        },
      },
    },
  },
};
