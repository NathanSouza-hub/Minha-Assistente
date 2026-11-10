// Formatos das mensagens do WhatsApp (valores em R$ no padrão brasileiro, datas em DD/MM) e a
// comparação de nomes sem diferenciar maiúsculas e acentos ("itau" acha "Itaú").
const { DateTime } = require('luxon');
const { FUSO } = require('../../lib/tempo');

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const emReais = (centavos) => reais.format(centavos / 100);
const diaCurto = (iso) => DateTime.fromISO(iso, { zone: FUSO }).toFormat('dd/MM');

const normalizar = (texto) =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const mesmoNome = (a, b) => normalizar(a) === normalizar(b);

module.exports = { emReais, diaCurto, normalizar, mesmoNome };
