const esquemas = require('./schema');
const { corpoJson, respostaJson, respostasErro, ERRO_AUTH } = require('../../docs/helpers');

const LIMITE = { 429: 'Muitas tentativas a partir deste IP (LIMITE_TENTATIVAS)' };

module.exports = {
  paths: {
    '/auth/cadastro': {
      post: {
        tags: ['Auth'],
        summary: 'Cria uma conta e já devolve o token',
        security: [],
        requestBody: corpoJson(esquemas.cadastro),
        responses: {
          201: respostaJson('Conta criada', esquemas.sessao),
          ...respostasErro({
            400: 'Dados inválidos (VALIDACAO)',
            409: 'E-mail já cadastrado (EMAIL_EM_USO)',
            ...LIMITE,
          }),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Entra com e-mail e senha',
        description: 'Após 10 tentativas erradas em 15 minutos, o IP é bloqueado temporariamente.',
        security: [],
        requestBody: corpoJson(esquemas.login),
        responses: {
          200: respostaJson('Sessão criada', esquemas.sessao),
          ...respostasErro({
            400: 'Dados inválidos (VALIDACAO)',
            401: 'E-mail ou senha incorretos (CREDENCIAIS_INVALIDAS)',
            ...LIMITE,
          }),
        },
      },
    },
    '/auth/senha': {
      put: {
        tags: ['Auth'],
        summary: 'Troca a senha e encerra as sessões dos outros aparelhos',
        description:
          'Tokens emitidos antes da troca passam a responder 401. Devolve uma sessão nova para ' +
          'quem trocou continuar conectado. Tentativas erradas contam no mesmo limite do login.',
        requestBody: corpoJson(esquemas.trocaSenha),
        responses: {
          200: respostaJson('Senha trocada; sessão nova', esquemas.sessao),
          ...respostasErro({
            ...ERRO_AUTH,
            400: 'Dados inválidos (VALIDACAO) ou senha atual errada (SENHA_INCORRETA)',
            ...LIMITE,
          }),
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Dados do usuário logado',
        responses: {
          200: respostaJson('Usuário', esquemas.usuario),
          ...respostasErro(ERRO_AUTH),
        },
      },
    },
  },
};
