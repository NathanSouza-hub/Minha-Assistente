const express = require('express');
const controller = require('./controller');
const esquemas = require('./schema');
const { validar } = require('../../middlewares/validar');
const { autenticar } = require('../../middlewares/autenticar');
const { limiteLogin, limiteCadastro } = require('../../middlewares/limitar');

function rotasAuth() {
  const rotas = express.Router();
  rotas.post('/cadastro', limiteCadastro(), validar({ body: esquemas.cadastro }), controller.cadastrar);
  rotas.post('/login', limiteLogin(), validar({ body: esquemas.login }), controller.entrar);
  rotas.get('/me', autenticar, controller.eu);
  rotas.put('/senha', autenticar, limiteLogin(), validar({ body: esquemas.trocaSenha }), controller.trocarSenha);
  return rotas;
}

module.exports = { rotasAuth };
