// Cliente da API do Claude (Anthropic), usado pelo assistente do WhatsApp. Os testes simulam a
// resposta com t.mock.method(claude, 'criarMensagem'): chame sempre pelo objeto do módulo.
const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');

const ativo = () => Boolean(env.ANTHROPIC_API_KEY);

let cliente;

/** POST /v1/messages. Lança os erros tipados da SDK (Anthropic.APIError e filhos). */
function criarMensagem(parametros) {
  if (env.NODE_ENV === 'test') throw new Error('Nos testes, simule claude.criarMensagem (nada sai para a Anthropic).');
  cliente ??= new Anthropic.default({ apiKey: env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 2 });
  return cliente.messages.create(parametros);
}

module.exports = { ativo, criarMensagem, APIError: Anthropic.APIError };
