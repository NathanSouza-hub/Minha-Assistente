require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { paraSnake, paraCamel, chavesParaCamel } = require('../src/lib/caso');

test('paraSnake e paraCamel convertem nos dois sentidos', () => {
  assert.equal(paraSnake('valorCentavos'), 'valor_centavos');
  assert.equal(paraSnake('lembretesMinutosAntes'), 'lembretes_minutos_antes');
  assert.equal(paraSnake('id'), 'id');
  assert.equal(paraCamel('parcelamento_grupo_id'), 'parcelamentoGrupoId');
  assert.equal(paraCamel('p256dh'), 'p256dh');
});

test('chavesParaCamel converte objetos e arrays aninhados e preserva valores', () => {
  const entrada = [{ data_pagamento: '2026-10-13', itens: [{ pago_centavos: 100 }], vazio: null }];
  assert.deepEqual(chavesParaCamel(entrada), [
    { dataPagamento: '2026-10-13', itens: [{ pagoCentavos: 100 }], vazio: null },
  ]);
});

test('chavesParaCamel não mexe em Date nem em primitivos', () => {
  const data = new Date();
  assert.equal(chavesParaCamel(data), data);
  assert.equal(chavesParaCamel(42), 42);
  assert.equal(chavesParaCamel('texto_snake'), 'texto_snake');
});
