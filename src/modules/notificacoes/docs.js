const esquemas = require('./schema');
const { corpoJson, respostaJson, respostaVazia, respostasErro, ERRO_AUTH } = require('../../docs/helpers');

const TAG = ['Notificações'];
const DESLIGADAS = { 503: 'Servidor sem chaves VAPID (NOTIFICACOES_DESLIGADAS)' };
const INVALIDO = { 400: 'Dados inválidos (VALIDACAO)' };

module.exports = {
  paths: {
    '/notificacoes/chave-publica': {
      get: {
        tags: TAG,
        summary: 'Chave pública VAPID',
        description: 'Valor de `applicationServerKey` para `pushManager.subscribe()` no navegador.',
        responses: {
          200: respostaJson('Chave', esquemas.chavePublica),
          ...respostasErro({ ...ERRO_AUTH, ...DESLIGADAS }),
        },
      },
    },
    '/notificacoes/inscricoes': {
      post: {
        tags: TAG,
        summary: 'Inscreve este navegador para receber lembretes',
        description:
          'Corpo = `PushSubscription.toJSON()` (o `expirationTime` é ignorado). O mesmo endpoint de novo atualiza a inscrição; se for de outro usuário, passa para quem enviou.',
        requestBody: corpoJson(esquemas.inscricao),
        responses: {
          201: respostaJson('Inscrição salva', esquemas.inscricaoSalva),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
      delete: {
        tags: TAG,
        summary: 'Cancela a inscrição deste navegador',
        description: 'Idempotente: responde 204 mesmo se a inscrição não existir.',
        requestBody: corpoJson(esquemas.cancelamento),
        responses: { 204: respostaVazia('Cancelada'), ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }) },
      },
    },
    '/notificacoes/teste': {
      post: {
        tags: TAG,
        summary: 'Envia uma notificação de teste para os aparelhos do usuário',
        responses: {
          204: respostaVazia('Enviada'),
          ...respostasErro({
            ...ERRO_AUTH,
            409: 'Nenhum aparelho inscrito ou inscrições expiradas (SEM_INSCRICAO)',
            ...DESLIGADAS,
          }),
        },
      },
    },
  },
};
