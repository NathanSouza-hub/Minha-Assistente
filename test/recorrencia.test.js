require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DateTime } = require('luxon');
const { expandir } = require('../src/lib/recorrencia');
const { FUSO } = require('../src/lib/tempo');

const dt = (iso) => DateTime.fromISO(iso, { zone: FUSO });
const dia = (iso) => dt(iso).startOf('day');
const inicios = (lista) => lista.map((o) => o.inicio.toFormat("yyyy-MM-dd'T'HH:mm"));

test('evento único: entra só se sobrepõe ao intervalo', () => {
  const serie = { inicio: dt('2026-10-20T23:30'), duracaoMs: 60 * 60_000, recorrencia: 'nenhuma', ate: null };
  // Começa no dia 20 e termina no dia 21: aparece nos dois dias.
  assert.equal(expandir(serie, dia('2026-10-20'), dia('2026-10-21')).length, 1);
  assert.equal(expandir(serie, dia('2026-10-21'), dia('2026-10-22')).length, 1);
  assert.equal(expandir(serie, dia('2026-10-22'), dia('2026-10-23')).length, 0);
});

test('semanal respeita o intervalo e a data final da repetição', () => {
  const serie = { inicio: dt('2026-10-05T09:00'), duracaoMs: 0, recorrencia: 'semanal', ate: '2026-10-26' };
  assert.deepEqual(inicios(expandir(serie, dia('2026-10-01'), dia('2026-11-30'))), [
    '2026-10-05T09:00',
    '2026-10-12T09:00',
    '2026-10-19T09:00',
    '2026-10-26T09:00',
  ]);
});

test('mensal do dia 31 não perde o dia', () => {
  const serie = { inicio: dt('2027-01-31T08:00'), duracaoMs: 0, recorrencia: 'mensal', ate: null };
  assert.deepEqual(inicios(expandir(serie, dia('2027-01-01'), dia('2027-05-01'))), [
    '2027-01-31T08:00',
    '2027-02-28T08:00',
    '2027-03-31T08:00',
    '2027-04-30T08:00',
  ]);
});

test('diária muito antiga pula direto para o intervalo pedido', () => {
  const serie = { inicio: dt('2020-01-01T07:00'), duracaoMs: 0, recorrencia: 'diaria', ate: null };
  assert.deepEqual(inicios(expandir(serie, dia('2026-10-13'), dia('2026-10-16'))), [
    '2026-10-13T07:00',
    '2026-10-14T07:00',
    '2026-10-15T07:00',
  ]);
});

test('anual e série que só começa depois do intervalo', () => {
  const anual = { inicio: dt('2024-02-29T10:00'), duracaoMs: 0, recorrencia: 'anual', ate: null };
  assert.deepEqual(inicios(expandir(anual, dia('2025-01-01'), dia('2026-12-31'))), [
    '2025-02-28T10:00',
    '2026-02-28T10:00',
  ]);
  const futura = { inicio: dt('2030-01-01T10:00'), duracaoMs: 0, recorrencia: 'diaria', ate: null };
  assert.equal(expandir(futura, dia('2026-01-01'), dia('2026-02-01')).length, 0);
});
