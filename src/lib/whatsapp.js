// Cliente da WhatsApp Cloud API (Meta). Os testes simulam o envio com
// t.mock.method(whatsapp, 'enviarTexto'): chame sempre pelo objeto do módulo, nunca desestruturado.
const crypto = require('node:crypto');
const env = require('../config/env');

const ativo = () => Boolean(env.WHATSAPP_TOKEN);

/**
 * Confere o cabeçalho X-Hub-Signature-256 ("sha256=<hex>"): HMAC do corpo BRUTO com o App Secret.
 * Comparação em tempo constante.
 */
function assinaturaValida(corpo, cabecalho) {
  if (!Buffer.isBuffer(corpo) || typeof cabecalho !== 'string' || !cabecalho.startsWith('sha256=')) return false;
  const esperada = crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(corpo).digest();
  const recebida = Buffer.from(cabecalho.slice('sha256='.length), 'hex');
  return recebida.length === esperada.length && crypto.timingSafeEqual(recebida, esperada);
}

/**
 * Manda uma mensagem de texto. Só vale dentro das 24 h depois da última mensagem da pessoa
 * (fora disso a Meta exige template). Lança erro se a Meta recusar.
 */
async function enviarTexto(para, texto) {
  if (env.NODE_ENV === 'test') throw new Error('Nos testes, simule whatsapp.enviarTexto (nada sai para a Meta).');
  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSAO}/${env.WHATSAPP_NUMERO_ID}/messages`;
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: para,
      type: 'text',
      text: { preview_url: false, body: texto },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(`WhatsApp respondeu ${resposta.status}: ${detalhe.slice(0, 300)}`);
  }
  return resposta.json();
}

module.exports = { ativo, assinaturaValida, enviarTexto };
