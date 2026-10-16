const express = require('express');
const controller = require('./controller');
const esquemas = require('./schema');
const { paramsId } = require('../../lib/esquemas');
const { validar } = require('../../middlewares/validar');
const { receberArquivo } = require('../../middlewares/upload');

function rotasPagamentos() {
  const rotas = express.Router();
  rotas.get('/', validar({ query: esquemas.filtros }), controller.listar);
  rotas.post('/', validar({ body: esquemas.criacao }), controller.criar);
  rotas.get('/:id', validar({ params: paramsId }), controller.buscar);
  rotas.put('/:id', validar({ params: paramsId, body: esquemas.edicao }), controller.atualizar);
  rotas.patch('/:id/pagar', validar({ params: paramsId, body: esquemas.pagar }), controller.pagar);
  rotas.delete('/:id', validar({ params: paramsId }), controller.remover);

  const paramsComprovante = validar({ params: esquemas.paramsComprovante });
  rotas.post('/:id/comprovantes', validar({ params: paramsId }), receberArquivo, controller.adicionarComprovante);
  rotas.get('/:id/comprovantes/:comprovanteId', paramsComprovante, controller.baixarComprovante);
  rotas.delete('/:id/comprovantes/:comprovanteId', paramsComprovante, controller.removerComprovante);
  return rotas;
}

module.exports = { rotasPagamentos };
