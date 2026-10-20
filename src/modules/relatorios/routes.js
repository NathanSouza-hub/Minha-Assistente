const express = require('express');
const controller = require('./controller');
const { filtrosGastos, filtrosFinanceiro } = require('./schema');
const { validar } = require('../../middlewares/validar');
const { paramsId } = require('../../lib/esquemas');

function rotasRelatorios() {
  const rotas = express.Router();
  rotas.get('/gastos', validar({ query: filtrosGastos }), controller.gastos);
  rotas.get('/financeiro', validar({ query: filtrosFinanceiro }), controller.financeiro);
  rotas.get('/imoveis/:id', validar({ params: paramsId, query: filtrosFinanceiro }), controller.imovel);
  return rotas;
}

module.exports = { rotasRelatorios };
