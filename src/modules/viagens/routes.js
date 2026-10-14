const express = require('express');
const controller = require('./controller');
const esquemas = require('./schema');
const { paramsId } = require('../../lib/esquemas');
const { validar } = require('../../middlewares/validar');
const { receberArquivo } = require('../../middlewares/upload');

function rotasViagens() {
  const rotas = express.Router();
  rotas.get('/', controller.listar);
  rotas.post('/', validar({ body: esquemas.corpo }), controller.criar);
  rotas.get('/:id', validar({ params: paramsId }), controller.buscar);
  rotas.put('/:id', validar({ params: paramsId, body: esquemas.corpo }), controller.atualizar);
  rotas.delete('/:id', validar({ params: paramsId }), controller.remover);

  rotas.post('/:id/anexos', validar({ params: paramsId }), receberArquivo, controller.adicionarAnexo);
  rotas.get('/:id/anexos/:anexoId', validar({ params: esquemas.paramsAnexo }), controller.baixarAnexo);
  rotas.delete('/:id/anexos/:anexoId', validar({ params: esquemas.paramsAnexo }), controller.removerAnexo);
  return rotas;
}

module.exports = { rotasViagens };
