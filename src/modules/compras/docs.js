const { z } = require('../../lib/zod');
const esquemas = require('./schema');
const {
  corpoJson,
  respostaJson,
  respostaVazia,
  respostasErro,
  parametrosQuery,
  paramId,
  ERRO_AUTH,
} = require('../../docs/helpers');

const TAG = ['Compras'];
const NAO_ENCONTRADO = { 404: 'Item não encontrado (NAO_ENCONTRADO)' };
const INVALIDO = { 400: 'Dados inválidos (VALIDACAO)' };

module.exports = {
  paths: {
    '/compras': {
      get: {
        tags: TAG,
        summary: 'Lista de compras',
        description: 'Pendentes primeiro (por categoria e nome); depois os comprados, mais recentes primeiro.',
        parameters: parametrosQuery(esquemas.filtros),
        responses: {
          200: respostaJson('Itens', z.array(esquemas.item)),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
      post: {
        tags: TAG,
        summary: 'Adiciona um item (pendente)',
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          201: respostaJson('Item criado', esquemas.item),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/compras/{id}': {
      put: {
        tags: TAG,
        summary: 'Edita nome, categoria e quantidade',
        parameters: [paramId],
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          200: respostaJson('Item atualizado', esquemas.item),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Remove o item',
        parameters: [paramId],
        responses: { 204: respostaVazia('Removido'), ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }) },
      },
    },
    '/compras/{id}/comprado': {
      patch: {
        tags: TAG,
        summary: 'Marca (ou desmarca) como comprado',
        description: 'Sem corpo, marca como comprado. `{ "comprado": false }` desmarca.',
        parameters: [paramId],
        requestBody: { ...corpoJson(esquemas.marcar), required: false },
        responses: {
          200: respostaJson('Item atualizado', esquemas.item),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
    },
  },
};
