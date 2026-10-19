const express = require('express');
const controller = require('./controller');
const esquemas = require('./schema');
const { validar } = require('../../middlewares/validar');
const { autenticar } = require('../../middlewares/autenticar');
const { limiteLogin, limiteCadastro } = require('../../middlewares/limitar');
const { AppError } = require('../../lib/erros');

// Com o cadastro fechado, contas novas só pelo comando do administrador (src/cli/criar-conta.js).
const exigirCadastroAberto = (aberto) => (req, res, next) => {
  if (!aberto) {
    throw new AppError(
      403,
      'CADASTRO_FECHADO',
      'O cadastro de contas novas está fechado. Peça a quem cuida do app para criar a sua.',
    );
  }
  next();
};

function rotasAuth({ cadastroAberto }) {
  const rotas = express.Router();
  rotas.get('/cadastro', (req, res) => res.json({ aberto: cadastroAberto }));
  rotas.post(
    '/cadastro',
    exigirCadastroAberto(cadastroAberto),
    limiteCadastro(),
    validar({ body: esquemas.cadastro }),
    controller.cadastrar,
  );
  rotas.post('/login', limiteLogin(), validar({ body: esquemas.login }), controller.entrar);
  rotas.get('/me', autenticar, controller.eu);
  rotas.put('/senha', autenticar, limiteLogin(), validar({ body: esquemas.trocaSenha }), controller.trocarSenha);
  return rotas;
}

module.exports = { rotasAuth };
