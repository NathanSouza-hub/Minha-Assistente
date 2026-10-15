// Regras da fatura do cartão de crédito. Funções puras: as parcelas não ficam no banco, são
// calculadas a partir da compra. Competência = mês do vencimento da fatura, sempre no dia 1
// ("2026-11-01"). Datas são textos ISO "AAAA-MM-DD".
const { DateTime } = require('luxon');

const mes = (iso) => DateTime.fromISO(iso).startOf('month');

// Dia que não existe no mês (31 em fevereiro) vira o último dia.
const diaNoMes = (inicioDoMes, dia) =>
  inicioDoMes.set({ day: Math.min(dia, inicioDoMes.daysInMonth) }).toISODate();

const somarMeses = (competencia, meses) => mes(competencia).plus({ months: meses }).toISODate();

// Com vencimento depois do fechamento, a fatura fecha no próprio mês; senão, no mês anterior.
function datasDaCompetencia({ diaFechamento, diaVencimento }, competencia) {
  const m = mes(competencia);
  const mesDoFechamento = diaVencimento > diaFechamento ? m : m.minus({ months: 1 });
  return {
    fechamento: diaNoMes(mesDoFechamento, diaFechamento),
    vencimento: diaNoMes(m, diaVencimento),
  };
}

// Primeira fatura cujo fechamento é depois da compra (no dia do fechamento vai para a seguinte).
// A fatura do mês da compra fecha nesse mês ou antes, então basta começar por ela.
function primeiraCompetencia(cartao, dataCompra) {
  let competencia = mes(dataCompra).toISODate();
  while (datasDaCompetencia(cartao, competencia).fechamento <= dataCompra) {
    competencia = somarMeses(competencia, 1);
  }
  return competencia;
}

// floor(total / n) em cada parcela; o resto dos centavos vai para a primeira.
function valoresDasParcelas(totalCentavos, parcelas) {
  const base = Math.floor(totalCentavos / parcelas);
  return Array.from({ length: parcelas }, (_, i) =>
    i === 0 ? base + (totalCentavos - base * parcelas) : base,
  );
}

function parcelasDaCompra(cartao, { valorTotalCentavos, parcelas, dataCompra }) {
  const primeira = primeiraCompetencia(cartao, dataCompra);
  return valoresDasParcelas(valorTotalCentavos, parcelas).map((valorCentavos, i) => ({
    parcela: i + 1,
    totalParcelas: parcelas,
    competencia: somarMeses(primeira, i),
    valorCentavos,
  }));
}

function situacaoDaFatura({ fechamento, pago }, hoje) {
  if (pago) return 'paga';
  return hoje >= fechamento ? 'fechada' : 'aberta';
}

module.exports = {
  datasDaCompetencia,
  primeiraCompetencia,
  valoresDasParcelas,
  parcelasDaCompra,
  situacaoDaFatura,
  somarMeses,
};
