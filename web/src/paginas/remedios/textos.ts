import type { HorarioRemedio, PeriodoRemedio } from '@/lib/tipos'

export const PERIODOS: Record<PeriodoRemedio, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  semanal: 'Uma vez por semana',
}

/** Índice = diaSemana da API (0 = domingo). */
export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** "Manhã, 08:00" · "Toda segunda, 09:00" · "Tarde" */
export function descreverHorario(h: Pick<HorarioRemedio, 'periodo' | 'hora' | 'diaSemana'>) {
  const quando =
    h.periodo === 'semanal' && h.diaSemana !== null
      ? `${h.diaSemana === 0 || h.diaSemana === 6 ? 'Todo' : 'Toda'} ${DIAS_SEMANA[h.diaSemana].toLowerCase()}`
      : PERIODOS[h.periodo]
  return h.hora ? `${quando}, ${h.hora}` : quando
}
