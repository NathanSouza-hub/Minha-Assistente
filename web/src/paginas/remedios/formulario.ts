// Formulário de remédio ↔ corpo da API. Regras espelhando src/modules/medicamentos/schema.js.
import { z } from 'zod'
import { hojeISO } from '@/lib/datas'
import type { Medicamento, MedicamentoCorpo, PeriodoRemedio } from '@/lib/tipos'

export const MAXIMO_HORARIOS = 12

/** Intervalos oferecidos em "Tomar a cada" (a API aceita de 1 a 24 horas). */
export const INTERVALOS = [4, 6, 8, 12, 24]

const DATA = /^\d{4}-\d{2}-\d{2}$/

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

export const esquemaRemedio = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome do remédio.').max(120, 'Nome longo demais.'),
    dose: z.string().max(120, 'Use no máximo 120 caracteres.'),
    observacoes: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
    ativo: z.boolean(),
    dataInicio: z.string().refine((v) => v === '' || DATA.test(v), 'Data inválida.'),
    dataFim: z.string().refine((v) => v === '' || DATA.test(v), 'Data inválida.'),
    /** '' = horários livres; senão, "a cada N horas". */
    intervaloHoras: z.string(),
    /** Só para montar os horários (não vai para a API). */
    primeiraDose: z.string(),
    horarios: z
      .array(horario)
      .min(1, 'Cadastre pelo menos um horário.')
      .max(MAXIMO_HORARIOS, `No máximo ${MAXIMO_HORARIOS} horários.`),
  })
  .superRefine((v, ctx) => {
    if (v.dataInicio && v.dataFim && v.dataFim < v.dataInicio) {
      ctx.addIssue({
        code: 'custom',
        path: ['dataFim'],
        message: 'O fim do uso precisa ser no dia do início ou depois.',
      })
    }
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

/** Período do dia pela hora: manhã das 5h às 11h59, tarde das 12h às 17h59, noite no resto. */
export function periodoDaHora(hora: string): PeriodoRemedio {
  const h = Number(hora.slice(0, 2))
  if (h >= 5 && h < 12) return 'manha'
  if (h >= 12 && h < 18) return 'tarde'
  return 'noite'
}

/**
 * Horários de "a cada N horas" a partir da primeira dose, dentro de um dia
 * (ex.: 8 h a partir das 08:00 → 08:00, 16:00, 00:00). Só soma horas: não decide dose nem horário.
 */
export function montarHorarios(intervaloHoras: number, primeiraDose: string): Omit<DadosHorario, 'id'>[] {
  const [h, m] = primeiraDose.split(':').map(Number)
  const quantidade = Math.min(Math.floor(24 / intervaloHoras), MAXIMO_HORARIOS)
  return Array.from({ length: quantidade }, (_, i) => {
    const hora = `${String((h + i * intervaloHoras) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    return { periodo: periodoDaHora(hora), hora, diaSemana: '' }
  })
}

export function valoresIniciais(m?: Medicamento): DadosRemedio {
  if (!m) {
    return {
      nome: '',
      dose: '',
      observacoes: '',
      ativo: true,
      dataInicio: hojeISO(),
      dataFim: '',
      intervaloHoras: '',
      primeiraDose: '08:00',
      horarios: [novoHorario()],
    }
  }
  return {
    nome: m.nome,
    dose: m.dose ?? '',
    observacoes: m.observacoes ?? '',
    ativo: m.ativo,
    dataInicio: m.dataInicio ?? '',
    dataFim: m.dataFim ?? '',
    intervaloHoras: m.intervaloHoras === null ? '' : String(m.intervaloHoras),
    primeiraDose: m.horarios.find((h) => h.hora)?.hora ?? '08:00',
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
  dataInicio: d.dataInicio || null,
  dataFim: d.dataFim || null,
  intervaloHoras: d.intervaloHoras ? Number(d.intervaloHoras) : null,
  horarios: d.horarios.map((h) => ({
    ...(h.id && { id: h.id }),
    periodo: h.periodo,
    hora: h.hora || null,
    diaSemana: h.periodo === 'semanal' ? Number(h.diaSemana) : null,
  })),
})
