const { z } = require('../../lib/zod');
const { corpoCartao, corpoCompra, cartao, compra, fatura } = require('./schema');
const {
  corpoJson,
  respostaJson,
  respostaVazia,
  respostasErro,
  paramId,
  ERRO_AUTH,
} = require('../../docs/helpers');

const TAG = ['Cartões'];
const paramCompra = { name: 'compraId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const paramCompetencia = {
  name: 'competencia',
  in: 'path',
  required: true,
  description: 'Mês da fatura (mês do vencimento), AAAA-MM',
  schema: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
};

const NAO_ENCONTRADO = { 404: 'Cartão ou compra não encontrados (NAO_ENCONTRADO)' };
const FATURA_PAGA = { 409: 'A mudança alteraria uma fatura já paga (FATURA_PAGA)' };

module.exports = {
  paths: {
    '/cartoes': {
      get: {
        tags: TAG,
        summary: 'Cartões do usuário com a fatura atual e o limite disponível',
        responses: {
          200: respostaJson('Cartões em ordem de exibição', z.array(cartao)),
          ...respostasErro(ERRO_AUTH),
        },
      },
      post: {
        tags: TAG,
        summary: 'Cria um cartão (sem ordem, vai para o fim)',
        requestBody: corpoJson(corpoCartao),
        responses: {
          201: respostaJson('Cartão criado', cartao),
          ...respostasErro({
            400: 'Dados inválidos (VALIDACAO)',
            ...ERRO_AUTH,
            409: 'Nome já usado, sem diferenciar maiúsculas (CARTAO_DUPLICADO)',
          }),
        },
      },
    },
    '/cartoes/{id}': {
      get: {
        tags: TAG,
        summary: 'Um cartão',
        parameters: [paramId],
        responses: { 200: respostaJson('Cartão', cartao), ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }) },
      },
      put: {
        tags: TAG,
        summary: 'Edita o cartão',
        description:
          'Mudar o dia de fechamento ou de vencimento recalcula as faturas pendentes. O nome novo vai para a descrição delas.',
        parameters: [paramId],
        requestBody: corpoJson(corpoCartao),
        responses: {
          200: respostaJson('Cartão atualizado', cartao),
          ...respostasErro({
            400: 'Dados inválidos (VALIDACAO)',
            ...ERRO_AUTH,
            ...NAO_ENCONTRADO,
            409: 'Nome já usado (CARTAO_DUPLICADO) ou fatura paga afetada (FATURA_PAGA)',
          }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Apaga o cartão, as compras e as faturas pendentes',
        parameters: [paramId],
        responses: {
          204: respostaVazia('Apagado'),
          ...respostasErro({
            ...ERRO_AUTH,
            ...NAO_ENCONTRADO,
            409: 'O cartão tem faturas pagas (REFERENCIA_INVALIDA)',
          }),
        },
      },
    },
    '/cartoes/{id}/faturas/{competencia}': {
      get: {
        tags: TAG,
        summary: 'Fatura do mês com as parcelas',
        description: 'Mês sem compras responde total 0 e lista vazia.',
        parameters: [paramId, paramCompetencia],
        responses: {
          200: respostaJson('Fatura', fatura),
          ...respostasErro({ 400: 'Competência inválida (VALIDACAO)', ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
    },
    '/cartoes/{id}/compras': {
      post: {
        tags: TAG,
        summary: 'Registra uma compra (à vista ou parcelada)',
        description:
          'A compra entra na primeira fatura que fecha depois da data dela; a parcela k cai k−1 meses depois. ' +
          'A conta de cada fatura em /pagamentos é criada ou atualizada.',
        parameters: [paramId],
        requestBody: corpoJson(corpoCompra),
        responses: {
          201: respostaJson('Compra criada', compra),
          ...respostasErro({ 400: 'Dados inválidos (VALIDACAO)', ...ERRO_AUTH, ...NAO_ENCONTRADO, ...FATURA_PAGA }),
        },
      },
    },
    '/cartoes/{id}/compras/{compraId}': {
      get: {
        tags: TAG,
        summary: 'Uma compra',
        parameters: [paramId, paramCompra],
        responses: { 200: respostaJson('Compra', compra), ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }) },
      },
      put: {
        tags: TAG,
        summary: 'Edita a compra e recalcula as faturas',
        parameters: [paramId, paramCompra],
        requestBody: corpoJson(corpoCompra),
        responses: {
          200: respostaJson('Compra atualizada', compra),
          ...respostasErro({ 400: 'Dados inválidos (VALIDACAO)', ...ERRO_AUTH, ...NAO_ENCONTRADO, ...FATURA_PAGA }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Apaga a compra; fatura que fica zerada é apagada',
        parameters: [paramId, paramCompra],
        responses: {
          204: respostaVazia('Apagada'),
          ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO, ...FATURA_PAGA }),
        },
      },
    },
  },
};
