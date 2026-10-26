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
    '/notificacoes/resumo': {
      get: {
        tags: TAG,
        summary: 'Preferência do resumo da manhã',
        description: 'Vem ligado às 07:00. O resumo só é enviado em dia com algo (agendamento, remédio, compromisso ou conta).',
        responses: { 200: respostaJson('Preferência', esquemas.resumo), ...respostasErro(ERRO_AUTH) },
      },
      put: {
        tags: TAG,
        summary: 'Liga, desliga ou muda a hora do resumo da manhã',
        requestBody: corpoJson(esquemas.resumo),
        responses: {
          200: respostaJson('Preferência salva', esquemas.resumo),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/notificacoes/avisos': {
      get: {
        tags: TAG,
        summary: 'O que avisar, por categoria',
        description:
          'agenda (eventos), remedios (doses), contas (vencimentos), compromissos (rotina) e tarefas (avulsas). Vem tudo ligado. O resumo da manhã tem preferência própria.',
        responses: { 200: respostaJson('Preferências', esquemas.avisos), ...respostasErro(ERRO_AUTH) },
      },
      put: {
        tags: TAG,
        summary: 'Liga ou desliga categorias de aviso (as ausentes ficam como estão)',
        description: 'Desligar cancela os lembretes pendentes da categoria; religar volta a gerar no próximo minuto.',
        requestBody: corpoJson(esquemas.avisosParcial),
        responses: {
          200: respostaJson('Preferências salvas', esquemas.avisos),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/notificacoes/whatsapp': {
      get: {
        tags: TAG,
        summary: 'Número de WhatsApp que recebe os lembretes',
        description:
          'Com número cadastrado e o servidor configurado (`disponivel`), os lembretes chegam também pelo WhatsApp, respeitando "O que avisar". Decisão 38.',
        responses: { 200: respostaJson('WhatsApp', esquemas.whatsappSalvo), ...respostasErro(ERRO_AUTH) },
      },
      put: {
        tags: TAG,
        summary: 'Cadastra, troca ou tira o número de WhatsApp',
        description:
          'Aceita o número como a pessoa escreve; 10 ou 11 dígitos ganham o 55 do Brasil. `null` tira o número e cancela os lembretes pendentes pelo WhatsApp.',
        requestBody: corpoJson(esquemas.whatsapp),
        responses: {
          200: respostaJson('WhatsApp salvo', esquemas.whatsappSalvo),
          ...respostasErro({ ...INVALIDO, ...ERRO_AUTH }),
        },
      },
    },
    '/notificacoes/whatsapp/teste': {
      post: {
        tags: TAG,
        summary: 'Envia uma mensagem de teste para o WhatsApp cadastrado',
        responses: {
          204: respostaVazia('A Meta aceitou a mensagem'),
          ...respostasErro({
            ...ERRO_AUTH,
            409: 'Sem número cadastrado (SEM_WHATSAPP) ou número recusado pela Meta (WHATSAPP_RECUSOU)',
            502: 'A Meta não aceitou a mensagem agora (WHATSAPP_FALHOU)',
            503: 'Servidor sem WHATSAPP_TOKEN/WHATSAPP_NUMERO_ID (WHATSAPP_DESLIGADO)',
          }),
        },
      },
    },
  },
};
