const express = require('express');
const controller = require('./controller');
const { filtrosGastos } = require('./schema');
const { validar } = require('../../middlewares/validar');

function rotasRelatorios() {
  const rotas = express.Router();
  rotas.get('/gastos', validar({ query: filtrosGastos }), controller.gastos);
  return rotas;
}

module.exports = { rotasRelatorios };
