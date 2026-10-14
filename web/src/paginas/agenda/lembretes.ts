// Lembretes da agenda. A API guarda só "minutos antes" (ex.: [1080, 120]); a pessoa escolhe por
// atalhos. "Na véspera às 18h" depende do horário do evento, por isso é convertido ao salvar.
import { DateTime } from 'luxon'
import { FUSO } from '@/lib/datas'

export const VESPERA = 'vespera-18h'

/** Atalhos oferecidos, na ordem em que aparecem. Valor: minutos antes, ou VESPERA. */
export const ATALHOS: { valor: number | typeof VESPERA; rotulo: string }[] = [
  { valor: VESPERA, rotulo: 'Na véspera às 18h' },
  { valor: 1440, rotulo: '1 dia antes' },
  { valor: 120, rotulo: '2 horas antes' },
  { valor: 60, rotulo: '1 hora antes' },
  { valor: 30, rotulo: '30 minutos antes' },
]

export const MAXIMO_LEMBRETES = 5

export type Lembrete = number | typeof VESPERA

/** Minutos entre as 18h do dia anterior e o início do evento ("HH:mm" em São Paulo). */
export function minutosVespera(data: string, hora: string) {
  const inicio = DateTime.fromISO(`${data}T${hora}`, { zone: FUSO })
  const vespera = inicio.minus({ days: 1 }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 })
  return Math.round(inicio.diff(vespera, 'minutes').minutes)
}

/** Escolhas do formulário → lista da API (sem repetição, em ordem decrescente). */
export function paraMinutos(escolhas: Lembrete[], data: string, hora: string) {
  const minutos = escolhas.map((e) => (e === VESPERA ? minutosVespera(data, hora) : e))
  return [...new Set(minutos)].filter((m) => m > 0).sort((a, b) => b - a)
}

/** Lista da API → escolhas do formulário (reconhece a véspera às 18h pelo horário). */
export function deMinutos(minutos: number[], data: string, hora: string): Lembrete[] {
  const vespera = minutosVespera(data, hora)
  return minutos.map((m) => (m === vespera ? VESPERA : m))
}

/** Texto de um lembrete fora dos atalhos: "45 minutos antes", "3 horas antes", "2 dias antes". */
export function descreverMinutos(minutos: number) {
  if (minutos % 1440 === 0) return minutos === 1440 ? '1 dia antes' : `${minutos / 1440} dias antes`
  if (minutos % 60 === 0) return minutos === 60 ? '1 hora antes' : `${minutos / 60} horas antes`
  return `${minutos} minutos antes`
}

export const rotuloDoLembrete = (l: Lembrete) =>
  ATALHOS.find((a) => a.valor === l)?.rotulo ?? descreverMinutos(l as number)
