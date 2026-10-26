const express = require('express');
const controller = require('./controller');
const { limitador } = require('../../middlewares/limitar');

function rotasWhatsapp() {
  const rotas = express.Router();
  rotas.get('/', controller.situacao);
  rotas.post(
    '/codigo',
    limitador({ janelaMs: 60 * 60_000, maximo: 10, mensagem: 'Muitos códigos pedidos. Aguarde uma hora e tente de novo.' }),
    controller.gerarCodigo,
  );
  rotas.delete('/', controller.desvincular);
  return rotas;
}

module.exports = { rotasWhatsapp };
