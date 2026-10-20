const { z } = require('../../lib/zod');
const { corpo, imovel } = require('./schema');
const {
  corpoJson,
  respostaJson,
  respostaVazia,
  respostasErro,
  paramId,
  ERRO_AUTH,
} = require('../../docs/helpers');

const TAG = ['Imóveis'];

module.exports = {
  paths: {
    '/imoveis': {
      get: {
        tags: TAG,
        summary: 'Imóveis do usuário',
        responses: { 200: respostaJson('Imóveis', z.array(imovel)), ...respostasErro(ERRO_AUTH) },
      },
      post: {
        tags: TAG,
        summary: 'Cadastra um imóvel',
        requestBody: corpoJson(corpo),
        responses: {
          201: respostaJson('Imóvel criado', imovel),
          ...respostasErro({
            400: 'Dados inválidos (VALIDACAO)',
            ...ERRO_AUTH,
            409: 'Nome já usado (IMOVEL_DUPLICADO)',
          }),
        },
      },
    },
    '/imoveis/{id}': {
      get: {
        tags: TAG,
        summary: 'Um imóvel',
        parameters: [paramId],
        responses: {
          200: respostaJson('Imóvel', imovel),
          ...respostasErro({ ...ERRO_AUTH, 404: 'Imóvel não encontrado (NAO_ENCONTRADO)' }),
        },
      },
      put: {
        tags: TAG,
        summary: 'Edita um imóvel (endereço e complemento ausentes ficam como estão)',
        parameters: [paramId],
        requestBody: corpoJson(corpo),
        responses: {
          200: respostaJson('Imóvel atualizado', imovel),
          ...respostasErro({
            400: 'Dados inválidos (VALIDACAO)',
            ...ERRO_AUTH,
            404: 'Imóvel não encontrado (NAO_ENCONTRADO)',
            409: 'Nome já usado (IMOVEL_DUPLICADO)',
          }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Remove um imóvel',
        parameters: [paramId],
        responses: {
          204: respostaVazia('Removido'),
          ...respostasErro({
            ...ERRO_AUTH,
            404: 'Imóvel não encontrado (NAO_ENCONTRADO)',
            409: 'Há pagamentos ligados ao imóvel (REFERENCIA_INVALIDA)',
          }),
        },
      },
    },
  },
};
