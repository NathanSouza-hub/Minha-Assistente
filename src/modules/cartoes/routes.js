const express = require('express');
const controller = require('./controller');
const esquemas = require('./schema');
const { paramsId } = require('../../lib/esquemas');
const { validar } = require('../../middlewares/validar');

function rotasCartoes() {
  const rotas = express.Router();
  rotas.get('/', controller.listar);
  rotas.post('/', validar({ body: esquemas.corpoCartao }), controller.criar);
  rotas.get('/:id', validar({ params: paramsId }), controller.buscar);
  rotas.put('/:id', validar({ params: paramsId, body: esquemas.corpoCartao }), controller.atualizar);
  rotas.delete('/:id', validar({ params: paramsId }), controller.remover);

  rotas.get('/:id/faturas/:competencia', validar({ params: esquemas.paramsFatura }), controller.fatura);
  rotas.post('/:id/compras', validar({ params: paramsId, body: esquemas.corpoCompra }), controller.criarCompra);
  rotas.get('/:id/compras/:compraId', validar({ params: esquemas.paramsCompra }), controller.buscarCompra);
  rotas.put(
    '/:id/compras/:compraId',
    validar({ params: esquemas.paramsCompra, body: esquemas.corpoCompra }),
    controller.atualizarCompra,
  );
  rotas.delete('/:id/compras/:compraId', validar({ params: esquemas.paramsCompra }), controller.removerCompra);
  return rotas;
}

module.exports = { rotasCartoes };
