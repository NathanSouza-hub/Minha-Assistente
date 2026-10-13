// Como o driver `pg` converte os tipos do Postgres em valores JS.
// Objetivo: a API devolver datas no formato do contrato sem passar por `Date` do JS,
// que interpreta "2026-10-13" como UTC e mostra o dia anterior no Brasil.
const { types } = require('pg');
const { DateTime } = require('luxon');
const { FUSO } = require('../lib/tempo');

const OID = {
  INT8: 20,
  NUMERIC: 1700,
  DATE: 1082,
  TIME: 1083,
  TIMESTAMPTZ: 1184,
};

let registrado = false;

function registrarTiposPg() {
  if (registrado) return;
  registrado = true;

  // date → "2026-10-13"
  types.setTypeParser(OID.DATE, (valor) => valor);

  // time → "08:00"
  types.setTypeParser(OID.TIME, (valor) => valor.slice(0, 5));

  // timestamptz → "2026-10-13T14:00:00-03:00" (sempre sem milissegundos)
  types.setTypeParser(OID.TIMESTAMPTZ, (valor) =>
    DateTime.fromSQL(valor, { setZone: true })
      .setZone(FUSO)
      .startOf('second')
      .toISO({ suppressMilliseconds: true }),
  );

  // count(*) e sum(...) vêm como bigint/numeric; o projeto só os usa para contagens e
  // somas de centavos, que cabem com folga em Number.
  types.setTypeParser(OID.INT8, (valor) => Number(valor));
  types.setTypeParser(OID.NUMERIC, (valor) => Number(valor));
}

module.exports = { registrarTiposPg };
