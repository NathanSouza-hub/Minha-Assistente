const { z } = require('../../lib/zod');
const esquemas = require('./schema');
const { MAXIMO_ANEXOS } = require('./service');
const { TAMANHO_MAXIMO_MB } = require('../../middlewares/upload');
const { DESCRICAO_TIPOS_ACEITOS } = require('../../lib/tipoArquivo');
const {
  corpoJson,
  respostaJson,
  respostaVazia,
  respostasErro,
  paramId,
  ERRO_AUTH,
} = require('../../docs/helpers');

const TAG = ['Viagens'];
const NAO_ENCONTRADA = { 404: 'Viagem não encontrada (NAO_ENCONTRADO)' };
const INVALIDO = { 400: 'Dados inválidos (VALIDACAO)' };
const paramAnexo = { name: 'anexoId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

module.exports = {
  paths: {
    '/viagens': {
      get: {
        tags: TAG,
        summary: 'Viagens do usuário (ida mais recente primeiro), com anexos',
        responses: { 200: respostaJson('Viagens', z.array(esquemas.viagem)), ...respostasErro(ERRO_AUTH) },
      },
      post: {
        tags: TAG,
        summary: 'Cadastra uma viagem',
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          201: respostaJson('Viagem criada', esquemas.viagem),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/viagens/{id}': {
      get: {
        tags: TAG,
        summary: 'Detalhe da viagem com anexos',
        parameters: [paramId],
        responses: {
          200: respostaJson('Viagem', esquemas.viagem),
          ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADA }),
        },
      },
      put: {
        tags: TAG,
        summary: 'Edita a viagem (anexos não mudam)',
        parameters: [paramId],
        requestBody: corpoJson(esquemas.corpo),
        responses: {
          200: respostaJson('Viagem atualizada', esquemas.viagem),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH, ...NAO_ENCONTRADA }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Remove a viagem e todos os anexos',
        parameters: [paramId],
        responses: { 204: respostaVazia('Removida'), ...respostasErro({ ...ERRO_AUTH, ...NAO_ENCONTRADA }) },
      },
    },
    '/viagens/{id}/anexos': {
      post: {
        tags: TAG,
        summary: 'Envia um anexo (passagem, voucher...)',
        description: [
          `\`multipart/form-data\` com um arquivo no campo \`arquivo\`, até ${TAMANHO_MAXIMO_MB} MB:`,
          `${DESCRICAO_TIPOS_ACEITOS}. O tipo é verificado pelo conteúdo do arquivo.`,
          `Até ${MAXIMO_ANEXOS} anexos por viagem.`,
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
          201: respostaJson('Anexo salvo', esquemas.anexo),
          ...respostasErro({
            400: 'Arquivo ausente ou campo errado (VALIDACAO / UPLOAD_INVALIDO)',
            ...ERRO_AUTH,
            ...NAO_ENCONTRADA,
            409: `Mais de ${MAXIMO_ANEXOS} anexos (LIMITE_ANEXOS)`,
            413: `Maior que ${TAMANHO_MAXIMO_MB} MB (ARQUIVO_GRANDE_DEMAIS)`,
            415: 'Tipo não aceito (TIPO_NAO_SUPORTADO)',
          }),
        },
      },
    },
    '/viagens/{id}/anexos/{anexoId}': {
      get: {
        tags: TAG,
        summary: 'Baixa o anexo',
        description: 'Responde o arquivo com `Content-Disposition: attachment` e o nome original.',
        parameters: [paramId, paramAnexo],
        responses: {
          200: {
            description: 'Arquivo',
            content: {
              'application/pdf': { schema: { type: 'string', format: 'binary' } },
              'image/*': { schema: { type: 'string', format: 'binary' } },
            },
          },
          ...respostasErro({ ...ERRO_AUTH, 404: 'Anexo não encontrado (NAO_ENCONTRADO)' }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Remove o anexo',
        parameters: [paramId, paramAnexo],
        responses: {
          204: respostaVazia('Removido'),
          ...respostasErro({ ...ERRO_AUTH, 404: 'Anexo não encontrado (NAO_ENCONTRADO)' }),
        },
      },
    },
  },
};
