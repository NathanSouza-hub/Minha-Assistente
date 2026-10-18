import { deDataHoraISO, deDataISO, diaDe } from '@/lib/datas'
import type { Evento } from '@/lib/tipos'

/** Agrupa ocorrências pelo dia em que começam (ou pelo 1º dia do período, se começaram antes). */
export function porDia(eventos: Evento[], primeiroDia: string) {
  const grupos = new Map<string, Evento[]>()
  for (const e of eventos) {
    const dia = diaDe(e.inicio) < primeiroDia ? primeiroDia : diaDe(e.inicio)
    grupos.set(dia, [...(grupos.get(dia) ?? []), e])
  }
  return grupos
}

/** Ocorrências que tocam o dia, com a mesma regra da API: o fim é exclusivo (até 00:00 não entra). */
export function eventosDoDia(eventos: Evento[], dia: string) {
  const comeco = deDataISO(dia)
  const amanha = comeco.plus({ days: 1 })
  return eventos.filter((e) => {
    const inicio = deDataHoraISO(e.inicio)
    return inicio < amanha && (e.fim ? deDataHoraISO(e.fim) > comeco : inicio >= comeco)
  })
}
