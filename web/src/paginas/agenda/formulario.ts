// Formulário de agendamento: data + horas separadas (como a pessoa pensa) ↔ ISO com fuso (API).
// Regras espelhando src/modules/eventos/schema.js do back-end.
import { z } from 'zod'
import { combinarDataHora, hojeISO, separarDataHora, somarDias } from '@/lib/datas'
import type { Evento, EventoCorpo, ModalidadeEvento, RecorrenciaEvento, TipoEvento } from '@/lib/tipos'
import { deMinutos, MAXIMO_LEMBRETES, paraMinutos, VESPERA, type Lembrete } from './lembretes'

const HORA = /^\d{2}:\d{2}$/
const DATA = /^\d{4}-\d{2}-\d{2}$/

export const esquemaEvento = z
  .object({
    titulo: z.string().trim().min(1, 'Informe o título.').max(200, 'Título longo demais.'),
    tipo: z.string().min(1, 'Escolha o tipo.'),
    modalidade: z.string(),
    data: z.string().regex(DATA, 'Informe a data.'),
    horaInicio: z.string().regex(HORA, 'Informe a hora.'),
    horaFim: z.string().refine((v) => v === '' || HORA.test(v), 'Hora inválida.'),
    local: z.string().max(300, 'Use no máximo 300 caracteres.'),
    link: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || /^https?:\/\/\S+\.\S+/.test(v),
        'Cole o endereço completo, começando com https://',
      ),
    observacoes: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
    recorrencia: z.enum(['nenhuma', 'diaria', 'semanal', 'mensal', 'anual']),
    recorrenciaFim: z.string(),
    lembretes: z
      .array(z.union([z.number(), z.literal(VESPERA)]))
      .max(MAXIMO_LEMBRETES, 'No máximo 5 lembretes.'),
  })
  .superRefine((v, ctx) => {
    if (v.horaFim && v.horaFim === v.horaInicio) {
      ctx.addIssue({ code: 'custom', path: ['horaFim'], message: 'O fim precisa ser depois do início.' })
    }
    if (v.recorrencia !== 'nenhuma' && v.recorrenciaFim && v.recorrenciaFim < v.data) {
      ctx.addIssue({
        code: 'custom',
        path: ['recorrenciaFim'],
        message: 'A repetição precisa terminar depois do primeiro dia.',
      })
    }
  })

export type DadosEvento = z.infer<typeof esquemaEvento>

/** Nomes da API → campos do formulário, para distribuir erros VALIDACAO do back-end. */
export const camposDaApi = {
  inicio: 'horaInicio',
  fim: 'horaFim',
  lembretesMinutosAntes: 'lembretes',
} as const

/** Fim antes do início no mesmo dia = termina no dia seguinte (ex.: 22:00 até 01:00). */
export const terminaNoDiaSeguinte = (d: Pick<DadosEvento, 'horaInicio' | 'horaFim'>) =>
  Boolean(d.horaFim && d.horaInicio && d.horaFim < d.horaInicio)

export function valoresIniciais(evento?: Evento, dataPadrao = hojeISO(), tipoPadrao = ''): DadosEvento {
  if (!evento) {
    return {
      titulo: '',
      tipo: tipoPadrao,
      modalidade: '',
      data: dataPadrao,
      horaInicio: '',
      horaFim: '',
      local: '',
      link: '',
      observacoes: '',
      recorrencia: 'nenhuma',
      recorrenciaFim: '',
      lembretes: [VESPERA, 120],
    }
  }
  // GET /eventos/:id devolve a série: `inicio` é o da primeira ocorrência.
  const { data, hora } = separarDataHora(evento.inicio)
  return {
    titulo: evento.titulo,
    tipo: evento.tipo,
    modalidade: evento.modalidade ?? '',
    data,
    horaInicio: hora,
    horaFim: evento.fim ? separarDataHora(evento.fim).hora : '',
    local: evento.local ?? '',
    link: evento.link ?? '',
    observacoes: evento.observacoes ?? '',
    recorrencia: evento.recorrencia,
    recorrenciaFim: evento.recorrenciaFim ?? '',
    lembretes: deMinutos(evento.lembretesMinutosAntes, data, hora) as Lembrete[],
  }
}

export function paraCorpo(d: DadosEvento): EventoCorpo {
  const diaDoFim = terminaNoDiaSeguinte(d) ? somarDias(d.data, 1) : d.data
  const recorrente = d.recorrencia !== 'nenhuma'
  return {
    titulo: d.titulo.trim(),
    tipo: d.tipo as TipoEvento,
    modalidade: (d.modalidade || null) as ModalidadeEvento | null,
    inicio: combinarDataHora(d.data, d.horaInicio),
    fim: d.horaFim ? combinarDataHora(diaDoFim, d.horaFim) : null,
    local: d.local.trim() || null,
    link: d.link.trim() || null,
    observacoes: d.observacoes.trim() || null,
    recorrencia: d.recorrencia as RecorrenciaEvento,
    recorrenciaFim: recorrente && d.recorrenciaFim ? d.recorrenciaFim : null,
    lembretesMinutosAntes: paraMinutos(d.lembretes, d.data, d.horaInicio),
  }
}
