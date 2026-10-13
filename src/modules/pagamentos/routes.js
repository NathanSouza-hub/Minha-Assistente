const express = require('express');
const controller = require('./controller');
const esquemas = require('./schema');
const { paramsId } = require('../../lib/esquemas');
const { validar } = require('../../middlewares/validar');

function rotasPagamentos() {
  const rotas = express.Router();
  rotas.get('/', validar({ query: esquemas.filtros }), controller.listar);
  rotas.post('/', validar({ body: esquemas.criacao }), controller.criar);
  rotas.get('/:id', validar({ params: paramsId }), controller.buscar);
  rotas.put('/:id', validar({ params: paramsId, body: esquemas.edicao }), controller.atualizar);
  rotas.patch('/:id/pagar', validar({ params: paramsId, body: esquemas.pagar }), controller.pagar);
  rotas.delete('/:id', validar({ params: paramsId }), controller.remover);
  return rotas;
}

module.exports = { rotasPagamentos };
