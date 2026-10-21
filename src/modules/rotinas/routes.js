const express = require('express');
const controller = require('./controller');
const esquemas = require('./schema');
const { paramsId } = require('../../lib/esquemas');
const { validar } = require('../../middlewares/validar');

function rotasRotinas() {
  const rotas = express.Router();
  // Rota fixa antes de /:id.
  rotas.get('/hoje', validar({ query: esquemas.filtroDia }), controller.doDia);

  rotas.get('/', controller.listar);
  rotas.post('/', validar({ body: esquemas.corpo }), controller.criar);
  rotas.put('/:id', validar({ params: paramsId, body: esquemas.corpo }), controller.atualizar);
  rotas.delete('/:id', validar({ params: paramsId }), controller.remover);
  rotas.post('/:id/concluir', validar({ params: paramsId, body: esquemas.conclusao }), controller.concluir);
  rotas.get(
    '/:id/historico',
    validar({ params: paramsId, query: esquemas.filtroHistorico }),
    controller.historico,
  );
  return rotas;
}

module.exports = { rotasRotinas };
