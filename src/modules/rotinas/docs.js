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

const TAG = ['Rotina'];
const NAO_ENCONTRADO = { 404: 'Tarefa não encontrada (NAO_ENCONTRADO)' };
const INVALIDO = { 400: 'Dados inválidos (VALIDACAO)' };

module.exports = {
  paths: {
    '/rotinas': {
      get: {
        tags: TAG,
        summary: 'Tarefas recorrentes do usuário (ativas e inativas)',
        responses: { 200: respostaJson('Tarefas', z.array(esquemas.rotina)), ...respostasErro(ERRO_AUTH) },
      },
      post: {
        tags: TAG,
        summary: 'Cria uma tarefa recorrente',
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          201: respostaJson('Tarefa criada', esquemas.rotina),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/rotinas/hoje': {
      get: {
        tags: TAG,
        summary: 'Tarefas ativas previstas para o dia, com status de concluída',
        parameters: parametrosQuery(esquemas.filtroDia),
        responses: {
          200: respostaJson('Itens do dia', z.array(esquemas.itemDoDia)),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/rotinas/{id}': {
      put: {
        tags: TAG,
        summary: 'Edita uma tarefa',
        parameters: [paramId],
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          200: respostaJson('Tarefa atualizada', esquemas.rotina),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Remove a tarefa e seu histórico',
        parameters: [paramId],
        responses: { 204: respostaVazia('Removida'), ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }) },
      },
    },
    '/rotinas/{id}/concluir': {
      post: {
        tags: TAG,
        summary: 'Marca (ou desmarca) a tarefa como feita num dia',
        description: 'Idempotente. `concluida: false` desfaz. Dia fora dos `diasSemana` da tarefa → 400.',
        parameters: [paramId],
        requestBody: { ...corpoJson(esquemas.conclusao), required: false },
        responses: {
          200: respostaJson('Item atualizado', esquemas.itemDoDia),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
    },
  },
};
