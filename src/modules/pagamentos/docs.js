const { z } = require('../../lib/zod');
const esquemas = require('./schema');
const {
  corpoJson,
  jsonSchema,
  respostaJson,
  respostaVazia,
  respostasErro,
  parametrosQuery,
  paramId,
  ERRO_AUTH,
} = require('../../docs/helpers');

const TAG = ['Pagamentos'];
const NAO_ENCONTRADO = { 404: 'Pagamento não encontrado (NAO_ENCONTRADO)' };
const FATURA_AUTOMATICA = { 409: 'Fatura de cartão: o valor vem das compras, só dá para pagar (FATURA_AUTOMATICA)' };
const INVALIDO = { 400: 'Dados inválidos, categoria ou imóvel inexistente (VALIDACAO)' };

module.exports = {
  paths: {
    '/pagamentos': {
      get: {
        tags: TAG,
        summary: 'Lista pagamentos (ordenados por vencimento)',
        description: 'O período (inicio/fim) filtra pelo vencimento.',
        parameters: parametrosQuery(esquemas.filtros),
        responses: {
          200: respostaJson('Pagamentos', z.array(esquemas.pagamento)),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
      post: {
        tags: TAG,
        summary: 'Cria um pagamento, ou N parcelas',
        description: [
          'Com `parcelamento.totalParcelas = N`, cria N parcelas mensais a partir de `vencimento`,',
          'cada uma com `valorCentavos`, e responde **array**. Sem parcelamento, responde objeto.',
          'Recorrente já criado como pago gera a próxima ocorrência.',
        ].join(' '),
        requestBody: corpoJson(esquemas.criacao),
        responses: {
          201: {
            description: 'Pagamento criado (objeto) ou parcelas criadas (array)',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    jsonSchema(esquemas.pagamento, 'output'),
                    jsonSchema(z.array(esquemas.pagamento), 'output'),
                  ],
                },
              },
            },
          },
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/pagamentos/{id}': {
      get: {
        tags: TAG,
        summary: 'Detalhe de um pagamento',
        parameters: [paramId],
        responses: {
          200: respostaJson('Pagamento', esquemas.pagamento),
          ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
      put: {
        tags: TAG,
        summary: 'Edita um pagamento',
        description: 'Mudar de pendente para pago num recorrente gera a próxima ocorrência.',
        parameters: [paramId],
        requestBody: corpoJson(esquemas.edicao),
        responses: {
          200: respostaJson('Pagamento atualizado', esquemas.pagamento),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADO, ...FATURA_AUTOMATICA }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Remove um pagamento (só este, mesmo se for parcela)',
        parameters: [paramId],
        responses: {
          204: respostaVazia('Removido'),
          ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO, ...FATURA_AUTOMATICA }),
        },
      },
    },
    '/pagamentos/{id}/pagar': {
      patch: {
        tags: TAG,
        summary: 'Marca como pago',
        description:
          'Sem `dataPagamento`, usa a data de hoje. Se for recorrente, cria a próxima ocorrência (mês ou ano seguinte).',
        parameters: [paramId],
        requestBody: { ...corpoJson(esquemas.pagar), required: false },
        responses: {
          200: respostaJson('Pagamento pago', esquemas.pagamento),
          ...respostasErro({
            400: 'Data inválida (VALIDACAO)',
            ...ERRO_AUTH,
            ...NAO_ENCONTRADO,
            409: 'Já estava pago (JA_PAGO)',
          }),
        },
      },
    },
  },
};
