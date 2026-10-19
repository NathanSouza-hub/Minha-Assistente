const express = require('express');
const controller = require('./controller');
const { filtro, paramsTarefa, marcacao } = require('./schema');
const { validar } = require('../../middlewares/validar');

function rotasHoje() {
  const rotas = express.Router();
  rotas.get('/', validar({ query: filtro }), controller.listar);
  rotas.patch('/:id', validar({ params: paramsTarefa, body: marcacao }), controller.marcar);
  return rotas;
}

module.exports = { rotasHoje };
