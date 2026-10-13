// JWT da sessão. O id do usuário vai em `sub`.
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ALGORITMO = 'HS256';

const assinar = (usuarioId) =>
  jwt.sign({}, env.JWT_SECRET, {
    subject: usuarioId,
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: ALGORITMO,
  });

// Lança TokenExpiredError ou JsonWebTokenError se inválido.
const verificar = (token) => jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITMO] });

module.exports = { assinar, verificar };
