// Remédios — regras espelhando src/modules/medicamentos do back-end (etapa 6).
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { deDataISO, hojeISO } from '@/lib/datas'
import type { DoseDoDia, HorarioRemedio, Medicamento, MedicamentoCorpo, SituacaoDose } from '@/lib/tipos'
import { agoraISO, banco, type MedicamentoMock } from './banco'
import { autenticado, erro, naoEncontrado } from './util'

const ORDEM = { manha: 0, tarde: 1, noite: 2, semanal: 3 }

const ordenarHorarios = (a: HorarioRemedio, b: HorarioRemedio) =>
  ORDEM[a.periodo] - ORDEM[b.periodo] ||
  (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') ||
  (a.diaSemana ?? 0) - (b.diaSemana ?? 0)

/** 0 = domingo ... 6 = sábado (Luxon: 1 = segunda ... 7 = domingo). */
const diaDaSemana = (data: string) => deDataISO(data).weekday % 7

const publico = ({ usuarioId: _u, ...m }: MedicamentoMock): Medicamento => ({
  ...m,
  horarios: [...m.horarios].sort(ordenarHorarios),
})

function validar(c: Partial<MedicamentoCorpo>): Response | null {
  const problemas: string[] = []
  if (!c.nome?.trim()) problemas.push('nome: Informe o nome do remédio.')
  const horarios = c.horarios ?? []
  if (horarios.length === 0) problemas.push('horarios: Cadastre pelo menos um horário.')
  if (horarios.length > 12) problemas.push('horarios: No máximo 12 horários.')
  horarios.forEach((h, i) => {
    if (h.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.hora))
      problemas.push(`horarios.${i}.hora: Hora inválida: use HH:MM, ex.: 08:00.`)
    if (h.periodo === 'semanal' && (h.diaSemana === null || h.diaSemana === undefined))
      problemas.push(`horarios.${i}.diaSemana: Informe o dia da semana do remédio semanal.`)
    if (h.periodo !== 'semanal' && h.diaSemana !== null && h.diaSemana !== undefined)
      problemas.push(`horarios.${i}.diaSemana: Dia da semana só vale para o período semanal.`)
  })
  if (c.dataInicio && c.dataFim && c.dataFim < c.dataInicio)
    problemas.push('dataFim: O fim do uso precisa ser no dia do início ou depois.')
  if (c.intervaloHoras != null && (c.intervaloHoras < 1 || c.intervaloHoras > 24))
    problemas.push('intervaloHoras: O intervalo vai de 1 a 24 horas.')
  return problemas.length ? erro(400, 'VALIDACAO', problemas.join('; ')) : null
}

const texto = (v: string | null | undefined) => v?.trim() || null

function itensDoDia(usuarioId: string, data: string) {
  const ordenar = (a: DoseDoDia, b: DoseDoDia) =>
    ORDEM[a.periodo] - ORDEM[b.periodo] ||
    (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') ||
    a.nome.localeCompare(b.nome)
  return banco.medicamentos
    .filter((m) => m.usuarioId === usuarioId)
    .flatMap((m) => m.horarios.map((h) => ({ m, h })))
    .map(({ m, h }) => ({ m, h, item: dose(m, h, data) }))
    .sort((a, b) => ordenar(a.item, b.item))
}

// Sem início ou fim, vale para qualquer dia.
const noPeriodo = (m: MedicamentoMock, data: string) =>
  (!m.dataInicio || m.dataInicio <= data) && (!m.dataFim || m.dataFim >= data)

const naoTomado = (usuarioId: string, horarioId: string, data: string) =>
  banco.registrosTarefa.some(
    (r) =>
      r.usuarioId === usuarioId &&
      r.categoria === 'remedio' &&
      r.itemId === horarioId &&
      r.dataOcorrencia === data &&
      r.status === 'nao_feito',
  )

/** O ✗ do remédio fica em tarefa_registro, como no back-end. */
export function limparNaoTomado(usuarioId: string, horarioId: string, data: string) {
  banco.registrosTarefa = banco.registrosTarefa.filter(
    (r) =>
      !(r.usuarioId === usuarioId && r.categoria === 'remedio' && r.itemId === horarioId && r.dataOcorrencia === data),
  )
}

function dose(m: MedicamentoMock, h: HorarioRemedio, data: string): DoseDoDia {
  const registro = banco.registrosRemedio.find((r) => r.horarioId === h.id && r.data === data)
  return {
    horarioId: h.id,
    medicamentoId: m.id,
    nome: m.nome,
    dose: m.dose,
    observacoes: m.observacoes,
    periodo: h.periodo,
    hora: h.hora,
    data,
    tomado: Boolean(registro),
    tomadoEm: registro?.tomadoEm ?? null,
    situacao: registro ? 'tomado' : naoTomado(m.usuarioId, h.id, data) ? 'nao_tomado' : 'pendente',
  }
}

const doUsuario = (usuarioId: string, id: string) =>
  banco.medicamentos.find((m) => m.id === id && m.usuarioId === usuarioId)

/** Doses do dia: diários + semanais do dia da semana, só ativos — o mesmo que doDia() no back-end. */
export function dosesDoDia(usuarioId: string, data: string) {
  const dia = diaDaSemana(data)
  return itensDoDia(usuarioId, data)
    .filter(({ m, h }) => m.ativo && noPeriodo(m, data) && (h.periodo !== 'semanal' || h.diaSemana === dia))
    .map(({ item }) => item)
}

export const handlersMedicamentos = [
  // Rotas fixas antes de /:id, como no back-end.
  http.get(
    `${API_URL}/medicamentos/hoje`,
    autenticado(({ request }, u) => {
      const data = new URL(request.url).searchParams.get('data') ?? hojeISO()
      return HttpResponse.json(dosesDoDia(u.id, data))
    }),
  ),

  http.post(
    `${API_URL}/medicamentos/registros`,
    autenticado(async ({ request }, u) => {
      const {
        horarioId,
        data = hojeISO(),
        tomado = true,
        situacao,
      } = (await request.json()) as {
        horarioId: string
        data?: string
        tomado?: boolean
        situacao?: SituacaoDose
      }
      const nova = situacao ?? (tomado ? 'tomado' : 'pendente')
      const achado = itensDoDia(u.id, data).find(({ h }) => h.id === horarioId)
      if (!achado) return naoEncontrado('Horário')
      if (achado.h.periodo === 'semanal' && achado.h.diaSemana !== diaDaSemana(data))
        return erro(400, 'VALIDACAO', 'data: este remédio semanal não é tomado nesse dia da semana.')
      if (!noPeriodo(achado.m, data))
        return erro(400, 'VALIDACAO', 'data: este dia está fora do período de uso do remédio.')
      limparNaoTomado(u.id, horarioId, data)
      const indice = banco.registrosRemedio.findIndex((r) => r.horarioId === horarioId && r.data === data)
      if (nova === 'tomado' && indice < 0) banco.registrosRemedio.push({ horarioId, data, tomadoEm: agoraISO() })
      if (nova !== 'tomado' && indice >= 0) banco.registrosRemedio.splice(indice, 1)
      if (nova === 'nao_tomado')
        banco.registrosTarefa.push({
          usuarioId: u.id,
          categoria: 'remedio',
          itemId: horarioId,
          dataOcorrencia: data,
          horario: achado.h.hora,
          status: 'nao_feito',
        })
      return HttpResponse.json(dose(achado.m, achado.h, data))
    }),
  ),

  http.get(
    `${API_URL}/medicamentos`,
    autenticado((_ctx, u) =>
      HttpResponse.json(
        banco.medicamentos
          .filter((m) => m.usuarioId === u.id)
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .map(publico),
      ),
    ),
  ),

  http.get(
    `${API_URL}/medicamentos/:id`,
    autenticado(({ params }, u) => {
      const m = doUsuario(u.id, String(params.id))
      return m ? HttpResponse.json(publico(m)) : naoEncontrado('Medicamento')
    }),
  ),

  http.post(
    `${API_URL}/medicamentos`,
    autenticado(async ({ request }, u) => {
      const corpo = (await request.json()) as MedicamentoCorpo
      const invalido = validar(corpo)
      if (invalido) return invalido
      const agora = agoraISO()
      const medicamento: MedicamentoMock = {
        id: crypto.randomUUID(),
        usuarioId: u.id,
        nome: corpo.nome.trim(),
        dose: texto(corpo.dose),
        observacoes: texto(corpo.observacoes),
        ativo: corpo.ativo ?? true,
        dataInicio: corpo.dataInicio ?? null,
        dataFim: corpo.dataFim ?? null,
        intervaloHoras: corpo.intervaloHoras ?? null,
        horarios: corpo.horarios.map((h) => ({
          id: crypto.randomUUID(),
          periodo: h.periodo,
          hora: h.hora ?? null,
          diaSemana: h.diaSemana ?? null,
        })),
        criadoEm: agora,
        atualizadoEm: agora,
      }
      banco.medicamentos.push(medicamento)
      return HttpResponse.json(publico(medicamento), { status: 201 })
    }),
  ),

  http.put(
    `${API_URL}/medicamentos/:id`,
    autenticado(async ({ request, params }, u) => {
      const m = doUsuario(u.id, String(params.id))
      if (!m) return naoEncontrado('Medicamento')
      const corpo = (await request.json()) as MedicamentoCorpo
      const invalido = validar(corpo)
      if (invalido) return invalido
      const horarios: HorarioRemedio[] = []
      for (const [i, h] of corpo.horarios.entries()) {
        if (h.id && !m.horarios.some((x) => x.id === h.id))
          return erro(400, 'VALIDACAO', `horarios.${i}.id: horário não encontrado neste medicamento.`)
        horarios.push({
          id: h.id ?? crypto.randomUUID(),
          periodo: h.periodo,
          hora: h.hora ?? null,
          diaSemana: h.diaSemana ?? null,
        })
      }
      // Horários removidos levam o histórico junto (ON DELETE CASCADE).
      const removidos = m.horarios.filter((h) => !horarios.some((x) => x.id === h.id)).map((h) => h.id)
      banco.registrosRemedio = banco.registrosRemedio.filter((r) => !removidos.includes(r.horarioId))
      Object.assign(m, {
        nome: corpo.nome.trim(),
        dose: texto(corpo.dose),
        observacoes: texto(corpo.observacoes),
        ativo: corpo.ativo ?? true,
        dataInicio: corpo.dataInicio ?? null,
        dataFim: corpo.dataFim ?? null,
        intervaloHoras: corpo.intervaloHoras ?? null,
        horarios,
        atualizadoEm: agoraISO(),
      })
      return HttpResponse.json(publico(m))
    }),
  ),

  http.delete(
    `${API_URL}/medicamentos/:id`,
    autenticado(({ params }, u) => {
      const indice = banco.medicamentos.findIndex((m) => m.id === String(params.id) && m.usuarioId === u.id)
      if (indice < 0) return naoEncontrado('Medicamento')
      const [apagado] = banco.medicamentos.splice(indice, 1)
      const ids = apagado.horarios.map((h) => h.id)
      banco.registrosRemedio = banco.registrosRemedio.filter((r) => !ids.includes(r.horarioId))
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
