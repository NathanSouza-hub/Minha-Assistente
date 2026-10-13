// Limite de requisições por IP. Cada chamada cria um contador novo (memória do processo),
// por isso as fábricas são chamadas ao montar as rotas.
const { rateLimit } = require('express-rate-limit');
const { AppError } = require('../lib/erros');

function limitador({ janelaMs, maximo, mensagem, contarSoFalhas = false }) {
  return rateLimit({
    windowMs: janelaMs,
    limit: maximo,
    skipSuccessfulRequests: contarSoFalhas,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => next(new AppError(429, 'LIMITE_TENTATIVAS', mensagem)),
  });
}

// Só tentativas que falharam contam: quem acerta a senha não é bloqueado.
const limiteLogin = () =>
  limitador({
    janelaMs: 15 * 60_000,
    maximo: 10,
    contarSoFalhas: true,
    mensagem: 'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.',
  });

const limiteCadastro = () =>
  limitador({
    janelaMs: 60 * 60_000,
    maximo: 10,
    mensagem: 'Muitos cadastros a partir desta rede. Tente de novo mais tarde.',
  });

module.exports = { limitador, limiteLogin, limiteCadastro };
