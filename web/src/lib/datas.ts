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

/** "Bom dia" até o meio-dia, "Boa tarde" até as 18h, "Boa noite" depois (e de madrugada). */
export function saudacao(hora = agora().hour) {
  if (hora >= 5 && hora < 12) return 'Bom dia'
  if (hora >= 12 && hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Segunda-feira da semana da data ("2026-10-13" → "2026-10-12"). */
export const inicioDaSemana = (data: string) => deDataISO(data).startOf('week').toISODate()!

/** Os 7 dias (seg→dom) da semana que começa em `segunda`. */
export const diasDaSemana = (segunda: string) =>
  Array.from({ length: 7 }, (_, i) => deDataISO(segunda).plus({ days: i }).toISODate()!)

export const somarDias = (data: string, dias: number) => deDataISO(data).plus({ days: dias }).toISODate()!

/** "2026-10-13" + "14:30" → "2026-10-13T14:30:00-03:00" (horário de São Paulo). */
export const combinarDataHora = (data: string, hora: string) =>
  paraDataHoraISO(DateTime.fromISO(`${data}T${hora}`, { zone: FUSO }))

/** "2026-10-13T14:30:00-03:00" → { data: "2026-10-13", hora: "14:30" } em São Paulo. */
export function separarDataHora(texto: string) {
  const dt = deDataHoraISO(texto)
  return { data: dt.toISODate()!, hora: dt.toFormat('HH:mm') }
}

/** Dia (AAAA-MM-DD, São Paulo) de um instante ISO. */
export const diaDe = (texto: string) => deDataHoraISO(texto).toISODate()!

/** "2026-10-13" → "Terça, 13 de outubro" (curto, para cabeçalhos de lista). */
export const diaCurto = (data: string) => maiuscula(deDataISO(data).toFormat("cccc, d 'de' LLLL").replace('-feira', ''))

/** Rótulo relativo quando fizer sentido: "Hoje", "Amanhã", senão o dia curto. */
export function rotuloDoDia(data: string, hoje = hojeISO()) {
  const dias = diasAte(data, hoje)
  if (dias === 0) return `Hoje, ${deDataISO(data).toFormat("d 'de' LLLL")}`
  if (dias === 1) return `Amanhã, ${deDataISO(data).toFormat("d 'de' LLLL")}`
  return diaCurto(data)
}
