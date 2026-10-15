// Regras da fatura do cartão — as mesmas de src/lib/fatura.js do back-end (usadas pelo mock e
// pelo resumo das parcelas no formulário). Competência = mês do vencimento, sempre no dia 1.
import type { DateTime } from 'luxon'
import { deDataISO } from './datas'

type Dias = { diaFechamento: number; diaVencimento: number }

const mes = (iso: string) => deDataISO(iso).startOf('month')

// Dia que não existe no mês (31 em fevereiro) vira o último dia.
const diaNoMes = (inicioDoMes: DateTime, dia: number) =>
  inicioDoMes.set({ day: Math.min(dia, inicioDoMes.daysInMonth!) }).toISODate()!

export const somarMesesCompetencia = (competencia: string, meses: number) =>
  mes(competencia).plus({ months: meses }).toISODate()!

/** Com vencimento depois do fechamento, a fatura fecha no próprio mês; senão, no anterior. */
export function datasDaCompetencia({ diaFechamento, diaVencimento }: Dias, competencia: string) {
  const m = mes(competencia)
  const mesDoFechamento = diaVencimento > diaFechamento ? m : m.minus({ months: 1 })
  return { fechamento: diaNoMes(mesDoFechamento, diaFechamento), vencimento: diaNoMes(m, diaVencimento) }
}

/** Primeira fatura que fecha depois da compra (no dia do fechamento vai para a seguinte). */
export function primeiraCompetencia(cartao: Dias, dataCompra: string) {
  let competencia = mes(dataCompra).toISODate()!
  while (datasDaCompetencia(cartao, competencia).fechamento <= dataCompra) {
    competencia = somarMesesCompetencia(competencia, 1)
  }
  return competencia
}

/** floor(total / n) em cada parcela; o resto dos centavos vai para a primeira. */
export function valoresDasParcelas(totalCentavos: number, parcelas: number) {
  const base = Math.floor(totalCentavos / parcelas)
  return Array.from({ length: parcelas }, (_, i) => (i === 0 ? base + (totalCentavos - base * parcelas) : base))
}

export function parcelasDaCompra(
  cartao: Dias,
  compra: { valorTotalCentavos: number; parcelas: number; dataCompra: string },
) {
  const primeira = primeiraCompetencia(cartao, compra.dataCompra)
  return valoresDasParcelas(compra.valorTotalCentavos, compra.parcelas).map((valorCentavos, i) => ({
    parcela: i + 1,
    totalParcelas: compra.parcelas,
    competencia: somarMesesCompetencia(primeira, i),
    valorCentavos,
  }))
}
