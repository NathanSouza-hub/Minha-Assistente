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
