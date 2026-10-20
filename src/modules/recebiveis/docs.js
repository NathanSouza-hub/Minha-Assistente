const { z } = require('../../lib/zod');
const esquemas = require('./schema');
const { MAXIMO_COMPROVANTES } = require('./comprovantes');
const { TAMANHO_MAXIMO_MB } = require('../../middlewares/upload');
const { DESCRICAO_TIPOS_ACEITOS } = require('../../lib/tipoArquivo');
const {
  corpoJson,
  respostaJson,
  respostaVazia,
  respostasErro,
  parametrosQuery,
  paramId,
  ERRO_AUTH,
} = require('../../docs/helpers');

const TAG = ['Recebíveis'];
const NAO_ENCONTRADO = { 404: 'Recebível não encontrado (NAO_ENCONTRADO)' };
const INVALIDO = { 400: 'Dados inválidos (VALIDACAO)' };
const paramRecebimento = { name: 'recebimentoId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const paramComprovante = { name: 'comprovanteId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

module.exports = {
  paths: {
    '/recebiveis': {
      get: {
        tags: TAG,
        summary: 'Lista recebíveis (valores a receber), pela data prevista',
        description: [
          'O período filtra pela `dataPrevista`. `status` é derivado dos recebimentos: `pendente`',
          '(nada recebido), `parcial` ou `recebido` (soma ≥ previsto, ou encerrado com menos).',
        ].join(' '),
        parameters: parametrosQuery(esquemas.filtros),
        responses: {
          200: respostaJson('Recebíveis', z.array(esquemas.recebivel)),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
      post: {
        tags: TAG,
        summary: 'Cadastra um recebível',
        description: 'Recorrência só quando informada: ao ser recebido, o recorrente ganha a próxima ocorrência.',
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          201: respostaJson('Recebível criado', esquemas.recebivel),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/recebiveis/{id}': {
      get: {
        tags: TAG,
        summary: 'Detalhe, com o histórico de recebimentos e os comprovantes',
        parameters: [paramId],
        responses: {
          200: respostaJson('Recebível', esquemas.recebivelDetalhe),
          ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
      put: {
        tags: TAG,
        summary: 'Edita o recebível (só esta ocorrência; as próximas da série nascem dela)',
        parameters: [paramId],
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          200: respostaJson('Recebível', esquemas.recebivel),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADO }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Exclui o recebível, com os recebimentos e comprovantes dele',
        parameters: [paramId],
        responses: { 204: respostaVazia('Excluído'), ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADO }) },
      },
    },
    '/recebiveis/{id}/recebimentos': {
      post: {
        tags: TAG,
        summary: 'Registra um recebimento (parcial ou total)',
        description: [
          'Soma ao histórico. Quando a soma chega ao previsto (ou com `encerrar: true`), o recebível',
          'fica `recebido`; recorrente ganha a próxima ocorrência. Responde o detalhe atualizado.',
        ].join(' '),
        parameters: [paramId],
        requestBody: corpoJson(esquemas.recebimentoCorpo),
        responses: {
          201: respostaJson('Recebível', esquemas.recebivelDetalhe),
          ...respostasErro({
            ...INVALIDO,
            ...ERRO_AUTH,
            ...NAO_ENCONTRADO,
            409: 'Já recebido (JA_RECEBIDO)',
          }),
        },
      },
    },
    '/recebiveis/{id}/recebimentos/{recebimentoId}': {
      delete: {
        tags: TAG,
        summary: 'Desfaz um recebimento do histórico (o recebível volta a aberto)',
        parameters: [paramId, paramRecebimento],
        responses: {
          200: respostaJson('Recebível', esquemas.recebivelDetalhe),
          ...respostasErro({ ...ERRO_AUTH, 404: 'Recebível ou recebimento não encontrado (NAO_ENCONTRADO)' }),
        },
      },
    },
    '/recebiveis/{id}/comprovantes': {
      post: {
        tags: TAG,
        summary: 'Anexa um comprovante (foto ou PDF)',
        description: [
          `\`multipart/form-data\` com um arquivo no campo \`arquivo\`, até ${TAMANHO_MAXIMO_MB} MB:`,
          `${DESCRICAO_TIPOS_ACEITOS}. Até ${MAXIMO_COMPROVANTES} por recebível.`,
        ].join(' '),
        parameters: [paramId],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['arquivo'],
                properties: { arquivo: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          201: { description: 'Comprovante anexado' },
          ...respostasErro({
            ...ERRO_AUTH,
            ...NAO_ENCONTRADO,
            409: `Mais de ${MAXIMO_COMPROVANTES} comprovantes (LIMITE_ANEXOS)`,
            413: `Maior que ${TAMANHO_MAXIMO_MB} MB (ARQUIVO_GRANDE_DEMAIS)`,
            415: 'Tipo não aceito (TIPO_NAO_SUPORTADO)',
          }),
        },
      },
    },
    '/recebiveis/{id}/comprovantes/{comprovanteId}': {
      get: {
        tags: TAG,
        summary: 'Baixa o comprovante',
        parameters: [paramId, paramComprovante],
        responses: {
          200: {
            description: 'Arquivo',
            content: {
              'application/pdf': { schema: { type: 'string', format: 'binary' } },
              'image/*': { schema: { type: 'string', format: 'binary' } },
            },
          },
          ...respostasErro({ ...ERRO_AUTH, 404: 'Comprovante não encontrado (NAO_ENCONTRADO)' }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Remove o comprovante',
        parameters: [paramId, paramComprovante],
        responses: {
          204: respostaVazia('Removido'),
          ...respostasErro({ ...ERRO_AUTH, 404: 'Comprovante não encontrado (NAO_ENCONTRADO)' }),
        },
      },
    },
  },
};
