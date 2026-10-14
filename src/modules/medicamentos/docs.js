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

const TAG = ['Medicamentos'];
const NAO_ENCONTRADO = { 404: 'Medicamento não encontrado (NAO_ENCONTRADO)' };
const INVALIDO = { 400: 'Dados inválidos (VALIDACAO)' };

module.exports = {
  paths: {
    '/medicamentos': {
      get: {
        tags: TAG,
        summary: 'Medicamentos do usuário (ativos e inativos) com horários',
        responses: {
          200: respostaJson('Medicamentos', z.array(esquemas.medicamento)),
          ...respostasErro(ERRO_AUTH),
        },
      },
      post: {
        tags: TAG,
        summary: 'Cadastra um medicamento com seus horários',
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          201: respostaJson('Medicamento criado', esquemas.medicamento),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/medicamentos/hoje': {
      get: {
        tags: TAG,
        summary: 'Horários do dia com status de tomado',
        description:
          'Inclui os horários diários (manhã, tarde, noite) e os semanais do dia da semana, só de medicamentos ativos.',
        parameters: parametrosQuery(esquemas.filtroDia),
        responses: {
          200: respostaJson('Itens do dia', z.array(esquemas.itemDoDia)),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/medicamentos/registros': {
      post: {
        tags: TAG,
        summary: 'Marca (ou desmarca) um horário como tomado',
        description: 'Idempotente: marcar de novo não duplica. `tomado: false` desfaz.',
        requestBody: corpoJson(esquemas.registro),
        responses: {
          200: respostaJson('Item atualizado', esquemas.itemDoDia),
          ...respostasErro({
            400: 'Dados inválidos ou semanal fora do dia (VALIDACAO)',
            ...ERRO_AUTH,
            404: 'Horário não encontrado (NAO_ENCONTRADO)',
          }),
        },
      },
    },
    '/medicamentos/{id}': {
      get: {
        tags: TAG,
        summary: 'Detalhe de um medicamento',
        parameters: [paramId],
        responses: {
          200: respostaJson('Medicamento', esquemas.medicamento),
          ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
      put: {
        tags: TAG,
        summary: 'Edita o medicamento e seus horários',
        description:
          'Horários com `id` são mantidos (com o histórico de "tomei"); sem `id` são criados; os que não vierem são removidos.',
        parameters: [paramId],
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          200: respostaJson('Medicamento atualizado', esquemas.medicamento),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Remove o medicamento, seus horários e histórico',
        parameters: [paramId],
        responses: {
          204: respostaVazia('Removido'),
          ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
    },
  },
};
