// Canais de envio. Novo canal = um arquivo com { nome, ativo, usuarios, enviar }, o registro aqui e
// uma migration trocando o CHECK de lembrete_envio.canal.
const app = require('./app');
const whatsapp = require('./whatsapp');

const canais = [app, whatsapp];

const porNome = Object.fromEntries(canais.map((c) => [c.nome, c]));

/** Canais configurados (ex.: o "app" só com as chaves VAPID). */
const canaisAtivos = () => canais.filter((c) => c.ativo());

module.exports = { canais, porNome, canaisAtivos };
