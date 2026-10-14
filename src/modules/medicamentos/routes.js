const express = require('express');
const controller = require('./controller');
const esquemas = require('./schema');
const { paramsId } = require('../../lib/esquemas');
const { validar } = require('../../middlewares/validar');

function rotasMedicamentos() {
  const rotas = express.Router();
  // Rotas fixas antes de /:id.
  rotas.get('/hoje', validar({ query: esquemas.filtroDia }), controller.doDia);
  rotas.post('/registros', validar({ body: esquemas.registro }), controller.registrar);

  rotas.get('/', controller.listar);
  rotas.post('/', validar({ body: esquemas.corpo }), controller.criar);
  rotas.get('/:id', validar({ params: paramsId }), controller.buscar);
  rotas.put('/:id', validar({ params: paramsId, body: esquemas.corpo }), controller.atualizar);
  rotas.delete('/:id', validar({ params: paramsId }), controller.remover);
  return rotas;
}

module.exports = { rotasMedicamentos };
