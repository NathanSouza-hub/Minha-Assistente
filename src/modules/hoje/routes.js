const express = require('express');
const controller = require('./controller');
const { filtro } = require('./schema');
const { validar } = require('../../middlewares/validar');

function rotasHoje() {
  const rotas = express.Router();
  rotas.get('/', validar({ query: filtro }), controller.painel);
  return rotas;
}

module.exports = { rotasHoje };
