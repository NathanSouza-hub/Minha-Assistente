// Formulário de remédio ↔ corpo da API. Regras espelhando src/modules/medicamentos/schema.js.
import { z } from 'zod'
import type { Medicamento, MedicamentoCorpo, PeriodoRemedio } from '@/lib/tipos'

export const MAXIMO_HORARIOS = 12

const horario = z
  .object({
    /** Horário já salvo: mandar o id no PUT preserva o histórico de "tomei". */
    id: z.string().optional(),
    periodo: z.enum(['manha', 'tarde', 'noite', 'semanal']),
    hora: z.string().refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Hora inválida.'),
    diaSemana: z.string(),
  })
  .superRefine((h, ctx) => {
    if (h.periodo === 'semanal' && h.diaSemana === '') {
      ctx.addIssue({ code: 'custom', path: ['diaSemana'], message: 'Escolha o dia da semana.' })
    }
  })

export const esquemaRemedio = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do remédio.').max(120, 'Nome longo demais.'),
  dose: z.string().max(120, 'Use no máximo 120 caracteres.'),
  observacoes: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
  ativo: z.boolean(),
  horarios: z
    .array(horario)
    .min(1, 'Cadastre pelo menos um horário.')
    .max(MAXIMO_HORARIOS, `No máximo ${MAXIMO_HORARIOS} horários.`),
})

export type DadosRemedio = z.infer<typeof esquemaRemedio>
export type DadosHorario = DadosRemedio['horarios'][number]

/** Hora sugerida ao escolher o período (a pessoa pode trocar ou apagar). */
export const HORA_SUGERIDA: Record<PeriodoRemedio, string> = {
  manha: '08:00',
  tarde: '14:00',
  noite: '20:00',
  semanal: '09:00',
}

export const novoHorario = (periodo: PeriodoRemedio = 'manha'): DadosHorario => ({
  periodo,
  hora: HORA_SUGERIDA[periodo],
  diaSemana: '',
})

export function valoresIniciais(m?: Medicamento): DadosRemedio {
  if (!m) return { nome: '', dose: '', observacoes: '', ativo: true, horarios: [novoHorario()] }
  return {
    nome: m.nome,
    dose: m.dose ?? '',
    observacoes: m.observacoes ?? '',
    ativo: m.ativo,
    horarios: m.horarios.map((h) => ({
      id: h.id,
      periodo: h.periodo,
      hora: h.hora ?? '',
      diaSemana: h.diaSemana === null ? '' : String(h.diaSemana),
    })),
  }
}

export const paraCorpo = (d: DadosRemedio): MedicamentoCorpo => ({
  nome: d.nome.trim(),
  dose: d.dose.trim() || null,
  observacoes: d.observacoes.trim() || null,
  ativo: d.ativo,
  horarios: d.horarios.map((h) => ({
    ...(h.id && { id: h.id }),
    periodo: h.periodo,
    hora: h.hora || null,
    diaSemana: h.periodo === 'semanal' ? Number(h.diaSemana) : null,
  })),
})
