// Canais de envio. Novo canal (ex.: WhatsApp) = um arquivo com { nome, ativo, usuarios, enviar },
// o registro aqui e uma migration trocando o CHECK de lembrete_envio.canal.
const app = require('./app');

const canais = [app];

const porNome = Object.fromEntries(canais.map((c) => [c.nome, c]));

/** Canais configurados (ex.: o "app" só com as chaves VAPID). */
const canaisAtivos = () => canais.filter((c) => c.ativo());

module.exports = { canais, porNome, canaisAtivos };
