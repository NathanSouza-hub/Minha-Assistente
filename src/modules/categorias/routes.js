const express = require('express');
const controller = require('./controller');
const { corpoCriar, corpoAtualizar } = require('./schema');
const { paramsId } = require('../../lib/esquemas');
const { validar } = require('../../middlewares/validar');

function rotasCategorias() {
  const rotas = express.Router();
  rotas.get('/', controller.listar);
  rotas.post('/', validar({ body: corpoCriar }), controller.criar);
  rotas.put('/:id', validar({ params: paramsId, body: corpoAtualizar }), controller.atualizar);
  rotas.delete('/:id', validar({ params: paramsId }), controller.remover);
  return rotas;
}

module.exports = { rotasCategorias };
