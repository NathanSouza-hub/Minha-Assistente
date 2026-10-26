// Webhook da Meta (público, sem token do app). Montado em src/app.js ANTES do express.json: a
// assinatura é conferida sobre o corpo bruto.
const express = require('express');
const env = require('../../config/env');
const whatsapp = require('../../lib/whatsapp');
const { AppError, naoAutorizado } = require('../../lib/erros');
const entrada = require('./entrada');

const desligado = () => new AppError(404, 'NAO_ENCONTRADO', 'Rota não encontrada.');

function rotasWebhookWhatsapp() {
  const rotas = express.Router();
  const controle = entrada.criarControle();

  // Verificação feita pela Meta ao cadastrar a URL: devolve o hub.challenge se o token bate.
  rotas.get('/', (req, res) => {
    if (!whatsapp.ativo()) throw desligado();
    if (req.query['hub.mode'] !== 'subscribe' || req.query['hub.verify_token'] !== env.WHATSAPP_VERIFY_TOKEN) {
      throw new AppError(403, 'PROIBIDO', 'Token de verificação inválido.');
    }
    res.type('text/plain').send(String(req.query['hub.challenge'] ?? ''));
  });

  rotas.post('/', express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
    if (!whatsapp.ativo()) throw desligado();
    if (!whatsapp.assinaturaValida(req.body, req.get('x-hub-signature-256'))) throw naoAutorizado('Assinatura inválida.');
    let corpo;
    try {
      corpo = JSON.parse(req.body.toString('utf8'));
    } catch {
      throw new AppError(400, 'VALIDACAO', 'JSON inválido.');
    }
    // Responde já: a Meta reenvia se demorar. As mensagens repetidas são descartadas pelo id.
    res.sendStatus(200);
    entrada.processar(corpo, controle).catch((erro) => console.error('WhatsApp: falha no webhook', erro.message));
  });

  return rotas;
}

module.exports = { rotasWebhookWhatsapp };
