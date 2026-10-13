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

const TAG = ['Agenda'];
const NAO_ENCONTRADO = { 404: 'Evento não encontrado (NAO_ENCONTRADO)' };
const INVALIDO = { 400: 'Dados inválidos (VALIDACAO)' };

module.exports = {
  paths: {
    '/eventos': {
      get: {
        tags: TAG,
        summary: 'Ocorrências da agenda num período',
        description: [
          'Eventos recorrentes vêm **expandidos**: uma entrada por ocorrência, todas com o `id` da',
          'série, `recorrente: true` e `inicio`/`fim` daquela ocorrência. Para editar a série, envie',
          '`inicioSerie` como `inicio` no PUT. Período padrão: hoje + 30 dias; máximo 366 dias.',
        ].join(' '),
        parameters: parametrosQuery(esquemas.filtros),
        responses: {
          200: respostaJson('Ocorrências em ordem de início', z.array(esquemas.evento)),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
      post: {
        tags: TAG,
        summary: 'Cria um evento (único ou recorrente)',
        description:
          '`lembretesMinutosAntes`: até 5 valores, ex.: `[1080, 120]` = 18h antes e 2h antes. `[]` = sem lembrete.',
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          201: respostaJson('Evento criado', esquemas.evento),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/eventos/{id}': {
      get: {
        tags: TAG,
        summary: 'A série/evento como foi cadastrado',
        parameters: [paramId],
        responses: {
          200: respostaJson('Evento', esquemas.evento),
          ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
      put: {
        tags: TAG,
        summary: 'Edita o evento (num recorrente, a série inteira)',
        parameters: [paramId],
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          200: respostaJson('Evento atualizado', esquemas.evento),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Remove o evento (num recorrente, a série inteira)',
        parameters: [paramId],
        responses: {
          204: respostaVazia('Removido'),
          ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
    },
  },
};
