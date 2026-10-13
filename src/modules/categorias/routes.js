const express = require('express');
const controller = require('./controller');

function rotasCategorias() {
  const rotas = express.Router();
  rotas.get('/', controller.listar);
  return rotas;
}

module.exports = { rotasCategorias };
