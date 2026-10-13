// Datas no fuso de referência da API. Nunca use `new Date("2026-10-13")`: o JS lê como UTC
// e, no Brasil, mostra o dia anterior. Use sempre estas funções (Luxon).
import { DateTime, Settings } from 'luxon'

export const FUSO = 'America/Sao_Paulo'

Settings.defaultLocale = 'pt-BR'

export const agora = () => DateTime.now().setZone(FUSO)

/** Data de hoje no formato da API: "2026-10-13". */
export const hojeISO = () => agora().toISODate()!

/** "2026-10-13" → DateTime no início desse dia, em São Paulo. */
export const deDataISO = (data: string) => DateTime.fromISO(data, { zone: FUSO })

/** "2026-10-13T14:00:00-03:00" → DateTime em São Paulo. */
export const deDataHoraISO = (texto: string) => DateTime.fromISO(texto, { setZone: true }).setZone(FUSO)

/** DateTime → "2026-10-13T14:00:00-03:00" (formato que a API espera). */
export const paraDataHoraISO = (dt: DateTime) =>
  dt.setZone(FUSO).startOf('second').toISO({ suppressMilliseconds: true })!

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** "2026-10-13" → "Terça-feira, 13 de outubro" */
export const dataPorExtenso = (data: string) =>
  maiuscula(deDataISO(data).toFormat("cccc, d 'de' LLLL"))

/** "2026-10-13" → "13/10/2026" */
export const dataCurta = (data: string) => deDataISO(data).toFormat('dd/MM/yyyy')

/** "2026-10-13T14:00:00-03:00" → "14:00" */
export const horaDe = (texto: string) => deDataHoraISO(texto).toFormat('HH:mm')

/** "2026-10" do mês de uma data ISO (ou de hoje). */
export const mesDe = (data = hojeISO()) => data.slice(0, 7)

/** "2026-10" → { inicio: "2026-10-01", fim: "2026-10-31" } */
export function intervaloDoMes(mes: string) {
  const inicio = DateTime.fromISO(`${mes}-01`, { zone: FUSO })
  return { inicio: inicio.toISODate()!, fim: inicio.endOf('month').toISODate()! }
}

/** "2026-10" + 1 → "2026-11" */
export const somarMeses = (mes: string, quantidade: number) =>
  DateTime.fromISO(`${mes}-01`, { zone: FUSO }).plus({ months: quantidade }).toFormat('yyyy-MM')

/** "2026-10" → "Outubro de 2026" */
export const nomeDoMes = (mes: string) =>
  maiuscula(DateTime.fromISO(`${mes}-01`, { zone: FUSO }).toFormat("LLLL 'de' yyyy"))

/** Diferença em dias de calendário entre hoje e a data (positivo = futuro). */
export const diasAte = (data: string, hoje = hojeISO()) =>
  Math.round(deDataISO(data).diff(deDataISO(hoje), 'days').days)

/** Texto do vencimento de uma conta pendente: "Venceu há 3 dias", "Vence hoje", "Vence 25/10". */
export function descreverVencimento(vencimento: string, hoje = hojeISO()) {
  const dias = diasAte(vencimento, hoje)
  if (dias < -1) return `Venceu há ${-dias} dias`
  if (dias === -1) return 'Venceu ontem'
  if (dias === 0) return 'Vence hoje'
  if (dias === 1) return 'Vence amanhã'
  if (dias <= 7) return `Vence em ${dias} dias`
  return `Vence ${deDataISO(vencimento).toFormat('dd/MM')}`
}
