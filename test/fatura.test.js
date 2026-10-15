require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  datasDaCompetencia,
  primeiraCompetencia,
  valoresDasParcelas,
  parcelasDaCompra,
  situacaoDaFatura,
} = require('../src/lib/fatura');

// Fecha dia 3, vence dia 10: a fatura de novembro fecha em 03/nov.
const mesmoMes = { diaFechamento: 3, diaVencimento: 10 };
// Fecha dia 25, vence dia 5: a fatura de novembro fecha em 25/out.
const mesSeguinte = { diaFechamento: 25, diaVencimento: 5 };

test('datas da competência com vencimento depois do fechamento no mesmo mês', () => {
  assert.deepEqual(datasDaCompetencia(mesmoMes, '2026-11-01'), {
    fechamento: '2026-11-03',
    vencimento: '2026-11-10',
  });
});

test('vencimento antes ou no dia do fechamento: fecha no mês anterior', () => {
  assert.deepEqual(datasDaCompetencia(mesSeguinte, '2026-11-01'), {
    fechamento: '2026-10-25',
    vencimento: '2026-11-05',
  });
  assert.deepEqual(datasDaCompetencia({ diaFechamento: 10, diaVencimento: 10 }, '2026-11-01'), {
    fechamento: '2026-10-10',
    vencimento: '2026-11-10',
  });
});

test('dia que não existe no mês vira o último dia', () => {
  const cartao = { diaFechamento: 31, diaVencimento: 30 };
  assert.deepEqual(datasDaCompetencia(cartao, '2026-03-01'), {
    fechamento: '2026-02-28',
    vencimento: '2026-03-30',
  });
  assert.deepEqual(datasDaCompetencia(cartao, '2026-02-01'), {
    fechamento: '2026-01-31',
    vencimento: '2026-02-28',
  });
});

test('primeira fatura: compra antes, no dia e depois do fechamento', () => {
  assert.equal(primeiraCompetencia(mesmoMes, '2026-11-02'), '2026-11-01');
  assert.equal(primeiraCompetencia(mesmoMes, '2026-11-03'), '2026-12-01', 'no dia vai para a seguinte');
  assert.equal(primeiraCompetencia(mesmoMes, '2026-11-20'), '2026-12-01');
  assert.equal(primeiraCompetencia(mesSeguinte, '2026-10-24'), '2026-11-01');
  assert.equal(primeiraCompetencia(mesSeguinte, '2026-10-25'), '2026-12-01');
  assert.equal(primeiraCompetencia(mesSeguinte, '2026-12-31'), '2027-02-01', 'vira o ano');
});

test('divide os centavos e o resto vai para a primeira parcela', () => {
  assert.deepEqual(valoresDasParcelas(1000, 3), [334, 333, 333]);
  assert.deepEqual(valoresDasParcelas(1001, 1), [1001]);
  assert.deepEqual(valoresDasParcelas(5, 4), [2, 1, 1, 1]);
});

test('parcela k cai na competência da primeira fatura + (k-1) meses', () => {
  const compra = { valorTotalCentavos: 1000, parcelas: 3, dataCompra: '2026-11-20' };
  assert.deepEqual(parcelasDaCompra(mesmoMes, compra), [
    { parcela: 1, totalParcelas: 3, competencia: '2026-12-01', valorCentavos: 334 },
    { parcela: 2, totalParcelas: 3, competencia: '2027-01-01', valorCentavos: 333 },
    { parcela: 3, totalParcelas: 3, competencia: '2027-02-01', valorCentavos: 333 },
  ]);
});

test('situação da fatura: paga, fechada ou aberta', () => {
  const datas = { fechamento: '2026-11-03' };
  assert.equal(situacaoDaFatura({ ...datas, pago: true }, '2026-10-01'), 'paga');
  assert.equal(situacaoDaFatura({ ...datas, pago: false }, '2026-11-03'), 'fechada');
  assert.equal(situacaoDaFatura({ ...datas, pago: false }, '2026-11-02'), 'aberta');
});
