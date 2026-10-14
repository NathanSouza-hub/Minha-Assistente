const express = require('express');
const controller = require('./controller');
const esquemas = require('./schema');
const { paramsId } = require('../../lib/esquemas');
const { validar } = require('../../middlewares/validar');

function rotasCompras() {
  const rotas = express.Router();
  rotas.get('/', validar({ query: esquemas.filtros }), controller.listar);
  rotas.post('/', validar({ body: esquemas.corpo }), controller.criar);
  rotas.put('/:id', validar({ params: paramsId, body: esquemas.corpo }), controller.atualizar);
  rotas.patch('/:id/comprado', validar({ params: paramsId, body: esquemas.marcar }), controller.marcar);
  rotas.delete('/:id', validar({ params: paramsId }), controller.remover);
  return rotas;
}

module.exports = { rotasCompras };
