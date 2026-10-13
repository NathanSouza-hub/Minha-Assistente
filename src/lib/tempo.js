const { DateTime } = require('luxon');

const FUSO = 'America/Sao_Paulo';

const agora = () => DateTime.now().setZone(FUSO);

// Data de hoje no fuso da usuária, no formato "2026-10-13".
const hoje = () => agora().toISODate();

// Converte um texto ISO 8601 (com ou sem offset) para DateTime no fuso de referência.
const deISO = (texto) => DateTime.fromISO(texto, { zone: FUSO });

// Formata um instante como ISO 8601 com offset de São Paulo, sem milissegundos.
const paraISO = (dt) => dt.setZone(FUSO).toISO({ suppressMilliseconds: true });

module.exports = { FUSO, agora, hoje, deISO, paraISO };
