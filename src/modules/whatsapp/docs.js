const esquemas = require('./schema');
const { respostaJson, respostaVazia, respostasErro, ERRO_AUTH } = require('../../docs/helpers');

const TAG = ['WhatsApp'];

module.exports = {
  paths: {
    '/whatsapp': {
      get: {
        tags: TAG,
        summary: 'Situação do WhatsApp da conta',
        responses: { 200: respostaJson('Situação', esquemas.situacao), ...respostasErro(ERRO_AUTH) },
      },
      delete: {
        tags: TAG,
        summary: 'Desliga o número da conta',
        description: 'Idempotente. O número deixa de falar pela conta; para ligar de novo, gere outro código.',
        responses: { 204: respostaVazia('Desligado'), ...respostasErro(ERRO_AUTH) },
      },
    },
    '/whatsapp/codigo': {
      post: {
        tags: TAG,
        summary: 'Gera o código para ligar o número',
        description:
          'Código de 6 dígitos, válido por 10 minutos; o anterior deixa de valer. A pessoa manda o código para o número do app e o webhook liga o número dela à conta (se o número estava em outra conta, sai de lá).',
        responses: {
          201: respostaJson('Código', esquemas.codigo),
          ...respostasErro({
            ...ERRO_AUTH,
            429: 'Mais de 10 códigos na hora (LIMITE_TENTATIVAS)',
            503: 'Servidor sem as chaves do WhatsApp (WHATSAPP_DESLIGADO)',
          }),
        },
      },
    },
    '/webhooks/whatsapp': {
      get: {
        tags: TAG,
        summary: 'Verificação do webhook pela Meta',
        security: [],
        description: 'Devolve `hub.challenge` em texto quando `hub.verify_token` = WHATSAPP_VERIFY_TOKEN.',
        responses: { 200: respostaVazia('hub.challenge'), ...respostasErro({ 403: 'Token errado (PROIBIDO)', 404: 'WhatsApp desligado' }) },
      },
      post: {
        tags: TAG,
        summary: 'Mensagens recebidas (chamado pela Meta)',
        security: [],
        description:
          'Exige `X-Hub-Signature-256` (HMAC-SHA256 do corpo com o App Secret). Responde 200 na hora e trata depois; mensagem repetida (mesmo id) é ignorada.',
        responses: {
          200: respostaVazia('Recebido'),
          ...respostasErro({ 400: 'JSON inválido (VALIDACAO)', 401: 'Assinatura inválida (NAO_AUTORIZADO)', 404: 'WhatsApp desligado' }),
        },
      },
    },
  },
};
