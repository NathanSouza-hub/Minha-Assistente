const express = require('express');
const controller = require('./controller');
const { filtrosGastos, filtrosFinanceiro } = require('./schema');
const { validar } = require('../../middlewares/validar');

function rotasRelatorios() {
  const rotas = express.Router();
  rotas.get('/gastos', validar({ query: filtrosGastos }), controller.gastos);
  rotas.get('/financeiro', validar({ query: filtrosFinanceiro }), controller.financeiro);
  return rotas;
}

module.exports = { rotasRelatorios };
