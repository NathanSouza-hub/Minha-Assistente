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

const TAG = ['Tarefas'];
const NAO_ENCONTRADA = { 404: 'Tarefa não encontrada (NAO_ENCONTRADO)' };
const INVALIDO = { 400: 'Dados inválidos (VALIDACAO)' };

module.exports = {
  paths: {
    '/tarefas': {
      get: {
        tags: TAG,
        summary: 'Tarefas avulsas, pela data (e hora)',
        parameters: parametrosQuery(esquemas.filtros),
        responses: {
          200: respostaJson('Tarefas', z.array(esquemas.tarefa)),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
      post: {
        tags: TAG,
        summary: 'Cria uma tarefa avulsa (aparece na tela Hoje do dia dela)',
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          201: respostaJson('Tarefa criada', esquemas.tarefa),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/tarefas/{id}': {
      get: {
        tags: TAG,
        summary: 'Uma tarefa',
        parameters: [paramId],
        responses: { 200: respostaJson('Tarefa', esquemas.tarefa), ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADA }) },
      },
      put: {
        tags: TAG,
        summary: 'Edita a tarefa (refaz os lembretes)',
        parameters: [paramId],
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          200: respostaJson('Tarefa', esquemas.tarefa),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADA }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Exclui a tarefa e cancela os lembretes dela',
        parameters: [paramId],
        responses: { 204: respostaVazia('Excluída'), ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADA }) },
      },
    },
    '/tarefas/{id}/concluir': {
      patch: {
        tags: TAG,
        summary: 'Conclui (guarda quando) ou reabre a tarefa',
        description: 'Sem corpo conclui; `{ "concluida": false }` reabre. Idempotente.',
        parameters: [paramId],
        requestBody: corpoJson(esquemas.conclusao),
        responses: {
          200: respostaJson('Tarefa', esquemas.tarefa),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADA }),
        },
      },
    },
  },
};
