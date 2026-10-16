const express = require('express');
const controller = require('./controller');
const { corpo } = require('./schema');
const { paramsId } = require('../../lib/esquemas');
const { validar } = require('../../middlewares/validar');

function rotasEquipe() {
  const rotas = express.Router();
  rotas.get('/', controller.listar);
  rotas.post('/', validar({ body: corpo }), controller.criar);
  rotas.get('/:id', validar({ params: paramsId }), controller.buscar);
  rotas.put('/:id', validar({ params: paramsId, body: corpo }), controller.atualizar);
  rotas.delete('/:id', validar({ params: paramsId }), controller.remover);
  return rotas;
}

module.exports = { rotasEquipe };
