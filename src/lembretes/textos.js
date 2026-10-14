// Textos e datas compartilhados pelos geradores de lembrete.
const { DateTime } = require('luxon');
const { FUSO } = require('../lib/tempo');

const instante = (valor) => DateTime.fromISO(valor).setZone(FUSO);

/** "2026-10-13" + "08:00" → DateTime em São Paulo. */
const naData = (data, hora) => DateTime.fromISO(`${data}T${hora}`, { zone: FUSO });

/** Os dias (AAAA-MM-DD) que o intervalo [de, ate) toca. */
function diasEntre(de, ate) {
  const dias = [];
  for (let d = de.startOf('day'); d < ate; d = d.plus({ days: 1 })) dias.push(d.toISODate());
  return dias;
}

/** "Hoje às 14:00", "Amanhã às 09:00", "20/12 às 08:30", contados a partir de `referencia`. */
function quando(momento, referencia) {
  const hora = momento.toFormat('HH:mm');
  const dias = momento.startOf('day').diff(referencia.startOf('day'), 'days').days;
  if (dias === 0) return `Hoje às ${hora}`;
  if (dias === 1) return `Amanhã às ${hora}`;
  return `${momento.toFormat('dd/MM')} às ${hora}`;
}

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatarCentavos = (centavos) => reais.format(centavos / 100);

const juntar = (...partes) => partes.filter(Boolean).join(' · ');

module.exports = { instante, naData, diasEntre, quando, formatarCentavos, juntar };
