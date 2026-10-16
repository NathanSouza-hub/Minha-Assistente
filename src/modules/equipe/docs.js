const { z } = require('../../lib/zod');
const { corpo, membro } = require('./schema');
const {
  corpoJson,
  respostaJson,
  respostaVazia,
  respostasErro,
  paramId,
  ERRO_AUTH,
} = require('../../docs/helpers');

const TAG = ['Equipe'];
const NAO_ENCONTRADA = { 404: 'Pessoa não encontrada (NAO_ENCONTRADO)' };

module.exports = {
  paths: {
    '/equipe': {
      get: {
        tags: TAG,
        summary: 'Pessoas da equipe (ativas primeiro) com os dias de pagamento',
        responses: {
          200: respostaJson('Equipe', z.array(membro)),
          ...respostasErro(ERRO_AUTH),
        },
      },
      post: {
        tags: TAG,
        summary: 'Cadastra uma pessoa',
        description:
          'O app cria sozinho, em /pagamentos, a conta de cada dia de pagamento no mês atual e no seguinte ' +
          '(a partir de hoje), com o valor previsto ou com o valor a definir.',
        requestBody: corpoJson(corpo),
        responses: {
          201: respostaJson('Pessoa cadastrada', membro),
          ...respostasErro({
            400: 'Dados inválidos (VALIDACAO)',
            ...ERRO_AUTH,
            409: 'Nome já usado, sem diferenciar maiúsculas (MEMBRO_DUPLICADO)',
          }),
        },
      },
    },
    '/equipe/{id}': {
      get: {
        tags: TAG,
        summary: 'Uma pessoa',
        parameters: [paramId],
        responses: { 200: respostaJson('Pessoa', membro), ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADA }) },
      },
      put: {
        tags: TAG,
        summary: 'Edita a pessoa',
        description:
          'Mudar dias ou valores previstos, ou desativar, refaz as contas pendentes que vencem de hoje em ' +
          'diante. Vencidas e pagas não mudam.',
        parameters: [paramId],
        requestBody: corpoJson(corpo),
        responses: {
          200: respostaJson('Pessoa atualizada', membro),
          ...respostasErro({
            400: 'Dados inválidos (VALIDACAO)',
            ...ERRO_AUTH,
            ...NAO_ENCONTRADA,
            409: 'Nome já usado (MEMBRO_DUPLICADO)',
          }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Exclui a pessoa e as contas dela (só se nunca recebeu)',
        parameters: [paramId],
        responses: {
          204: respostaVazia('Excluída'),
          ...respostasErro({
            ...ERRO_AUTH,
            ...NAO_ENCONTRADA,
            409: 'Já recebeu pagamentos: desative em vez de excluir (REFERENCIA_INVALIDA)',
          }),
        },
      },
    },
  },
};
