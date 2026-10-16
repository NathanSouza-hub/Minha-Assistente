// JWT da sessão. O id do usuário vai em `sub` e a versão da sessão em `v` (trocar a senha a
// incrementa e os tokens de versão antiga deixam de valer; ver `autenticar`).
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ALGORITMO = 'HS256';

const assinar = (usuarioId, versaoSessao = 0) =>
  jwt.sign({ v: versaoSessao }, env.JWT_SECRET, {
    subject: usuarioId,
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: ALGORITMO,
  });

// Lança TokenExpiredError ou JsonWebTokenError se inválido.
const verificar = (token) => jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITMO] });

module.exports = { assinar, verificar };
