import { diaDe } from '@/lib/datas'
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
