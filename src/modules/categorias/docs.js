const { z } = require('../../lib/zod');
const { corpoCriar, corpoAtualizar, categoria } = require('./schema');
const {
  corpoJson,
  respostaJson,
  respostaVazia,
  respostasErro,
  paramId,
  ERRO_AUTH,
} = require('../../docs/helpers');

const TAG = ['Pagamentos'];

module.exports = {
  paths: {
    '/categorias-pagamento': {
      get: {
        tags: TAG,
        summary: 'Categorias de pagamento do usuário (as 4 padrão nascem no cadastro)',
        responses: {
          200: respostaJson('Categorias em ordem de exibição', z.array(categoria)),
          ...respostasErro(ERRO_AUTH),
        },
      },
      post: {
        tags: TAG,
        summary: 'Cria uma categoria (sem ordem, vai para o fim)',
        requestBody: corpoJson(corpoCriar),
        responses: {
          201: respostaJson('Categoria criada', categoria),
          ...respostasErro({
            400: 'Dados inválidos (VALIDACAO)',
            ...ERRO_AUTH,
            409: 'Nome já usado, sem diferenciar maiúsculas (CATEGORIA_DUPLICADA)',
          }),
        },
      },
    },
    '/categorias-pagamento/{id}': {
      put: {
        tags: TAG,
        summary: 'Renomeia e/ou reordena uma categoria',
        parameters: [paramId],
        requestBody: corpoJson(corpoAtualizar),
        responses: {
          200: respostaJson('Categoria atualizada', categoria),
          ...respostasErro({
            400: 'Dados inválidos (VALIDACAO)',
            ...ERRO_AUTH,
            404: 'Categoria não encontrada (NAO_ENCONTRADO)',
            409: 'Nome já usado (CATEGORIA_DUPLICADA)',
          }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Apaga uma categoria sem contas',
        parameters: [paramId],
        responses: {
          204: respostaVazia('Apagada'),
          ...respostasErro({
            ...ERRO_AUTH,
            404: 'Categoria não encontrada (NAO_ENCONTRADO)',
            409: 'Há contas nessa categoria (REFERENCIA_INVALIDA)',
          }),
        },
      },
    },
  },
};
