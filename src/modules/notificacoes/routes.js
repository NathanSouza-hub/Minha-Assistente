const express = require('express');
const controller = require('./controller');
const esquemas = require('./schema');
const { validar } = require('../../middlewares/validar');

function rotasNotificacoes() {
  const rotas = express.Router();
  rotas.get('/chave-publica', controller.chavePublica);
  rotas.post('/inscricoes', validar({ body: esquemas.inscricao }), controller.inscrever);
  rotas.delete('/inscricoes', validar({ body: esquemas.cancelamento }), controller.cancelar);
  rotas.post('/teste', controller.testar);
  rotas.get('/resumo', controller.lerResumo);
  rotas.put('/resumo', validar({ body: esquemas.resumo }), controller.salvarResumo);
  rotas.get('/avisos', controller.lerAvisos);
  rotas.put('/avisos', validar({ body: esquemas.avisosParcial }), controller.salvarAvisos);
  return rotas;
}

module.exports = { rotasNotificacoes };
