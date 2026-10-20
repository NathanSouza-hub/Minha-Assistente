// Agenda — regras espelhando src/modules/eventos e src/lib/recorrencia.js do back-end (etapa 5).
import { http, HttpResponse } from 'msw'
import { DateTime } from 'luxon'
import { API_URL } from '@/lib/api'
import { FUSO, hojeISO, paraDataHoraISO } from '@/lib/datas'
import type { Evento, EventoCorpo, RecorrenciaEvento } from '@/lib/tipos'
import { agoraISO, banco, type EventoMock } from './banco'
import { autenticado, erro, naoEncontrado } from './util'

const UNIDADE = { diaria: 'days', semanal: 'weeks', mensal: 'months', anual: 'years' } as const

const instante = (iso: string) => DateTime.fromISO(iso, { setZone: true }).setZone(FUSO)

/** Porta de expandir(): ocorrências calculadas a partir do início da série. */
function expandir(
  inicio: DateTime,
  duracaoMs: number,
  recorrencia: RecorrenciaEvento,
  ultimoDia: string | null,
  de: DateTime,
  ate: DateTime,
) {
  const sobrepoe = (ini: DateTime, fim: DateTime) => ini < ate && (duracaoMs ? fim > de : ini >= de)
  const ocorrencia = (ini: DateTime) => ({ inicio: ini, fim: ini.plus({ milliseconds: duracaoMs }) })
  if (recorrencia === 'nenhuma') {
    const unica = ocorrencia(inicio)
    return sobrepoe(unica.inicio, unica.fim) ? [unica] : []
  }
  const unidade = UNIDADE[recorrencia]
  const limite = ultimoDia
    ? DateTime.fromISO(ultimoDia, { zone: FUSO }).plus({ days: 1 }).startOf('day')
    : null
  let passo = Math.max(
    0,
    Math.floor(de.minus({ milliseconds: duracaoMs }).diff(inicio, unidade).as(unidade)) - 1,
  )
  const resultado = []
  while (resultado.length < 2000) {
    const ini = inicio.plus({ [unidade]: passo })
    if (ini >= ate || (limite && ini >= limite)) break
    const atual = ocorrencia(ini)
    if (sobrepoe(atual.inicio, atual.fim)) resultado.push(atual)
    passo += 1
  }
  return resultado
}

const serie = ({ usuarioId: _u, ...e }: EventoMock): Evento => ({
  ...e,
  recorrente: e.recorrencia !== 'nenhuma',
  inicioSerie: e.inicio,
})

const TIPOS = [
  'reuniao_pessoal',
  'exame',
  'consulta',
  'video',
  'programa_radio',
  'fisioterapia',
  'atividade_fisica',
  'videoconferencia',
  'podcast',
  'gravacao',
  'entrevista',
  'outro',
]
const DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

/** Validações do schema.js; devolve a resposta de erro ou o corpo normalizado. */
function validar(c: Partial<EventoCorpo>): Response | EventoCorpo {
  const problemas: string[] = []
  if (!c.titulo?.trim()) problemas.push('titulo: Informe o título.')
  if (!TIPOS.includes(c.tipo ?? '')) problemas.push('tipo: Escolha o tipo.')
  if (c.tipo === 'outro' && !c.tipoDescricao?.trim()) problemas.push('tipoDescricao: Descreva o compromisso.')
  if (!DATA_HORA.test(c.inicio ?? ''))
    problemas.push('inicio: Data e hora inválidas: use ISO 8601 com fuso, ex.: 2026-10-20T10:00:00-03:00.')
  if (c.fim && !DATA_HORA.test(c.fim)) problemas.push('fim: Data e hora inválidas.')
  if (c.link && !/^https?:\/\/\S+$/.test(c.link))
    problemas.push('link: Link inválido: use um endereço http(s).')
  const lembretes = c.lembretesMinutosAntes ?? []
  if (lembretes.length > 5) problemas.push('lembretesMinutosAntes: No máximo 5 lembretes.')
  if (new Set(lembretes).size !== lembretes.length)
    problemas.push('lembretesMinutosAntes: Há lembretes repetidos.')
  if (problemas.length === 0 && c.fim && instante(c.fim) <= instante(c.inicio!))
    problemas.push('fim: O fim precisa ser depois do início.')
  const recorrencia = c.recorrencia ?? 'nenhuma'
  if (c.recorrenciaFim && recorrencia === 'nenhuma')
    problemas.push('recorrenciaFim: Só eventos recorrentes têm data final de repetição.')
  if (problemas.length) return erro(400, 'VALIDACAO', problemas.join('; '))

  const texto = (v: string | null | undefined) => v?.trim() || null
  return {
    titulo: c.titulo!.trim(),
    tipo: c.tipo!,
    tipoDescricao: c.tipo === 'outro' ? c.tipoDescricao!.trim() : null,
    modalidade: c.modalidade ?? null,
    inicio: c.inicio!,
    fim: c.fim ?? null,
    local: texto(c.local),
    link: texto(c.link),
    observacoes: texto(c.observacoes),
    recorrencia,
    recorrenciaFim: recorrencia === 'nenhuma' ? null : (c.recorrenciaFim ?? null),
    lembretesMinutosAntes: lembretes,
  }
}

// A resposta sempre vem em -03:00, como no back-end.
const normalizarInstantes = (c: EventoCorpo): EventoCorpo => ({
  ...c,
  inicio: paraDataHoraISO(instante(c.inicio)),
  fim: c.fim ? paraDataHoraISO(instante(c.fim)) : null,
})

const doUsuario = (usuarioId: string, id: string) =>
  banco.eventos.find((e) => e.id === id && e.usuarioId === usuarioId)

/** Ocorrências entre os dias (inclusive), séries expandidas — o mesmo que listar() no back-end. */
export function ocorrenciasDoPeriodo(
  usuarioId: string,
  primeiroDia: string,
  ultimoDia: string,
  tipo?: string | null,
) {
  const de = DateTime.fromISO(primeiroDia, { zone: FUSO }).startOf('day')
  const ate = DateTime.fromISO(ultimoDia, { zone: FUSO }).plus({ days: 1 }).startOf('day')
  return banco.eventos
    .filter((e) => e.usuarioId === usuarioId && (!tipo || e.tipo === tipo))
    .flatMap((e) => {
      const inicio = instante(e.inicio)
      const duracaoMs = e.fim ? instante(e.fim).diff(inicio).as('milliseconds') : 0
      return expandir(inicio, duracaoMs, e.recorrencia, e.recorrenciaFim, de, ate).map((o) => ({
        ...serie(e),
        inicio: paraDataHoraISO(o.inicio),
        fim: e.fim ? paraDataHoraISO(o.fim) : null,
      }))
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo))
}

export const handlersEventos = [
  http.get(
    `${API_URL}/eventos`,
    autenticado(({ request }, u) => {
      const q = new URL(request.url).searchParams
      const primeiroDia = q.get('inicio') ?? hojeISO()
      const ultimoDia = q.get('fim') ?? DateTime.fromISO(primeiroDia).plus({ days: 30 }).toISODate()!
      if (ultimoDia < primeiroDia)
        return erro(400, 'VALIDACAO', 'fim: O início precisa ser anterior ou igual ao fim.')
      if (DateTime.fromISO(ultimoDia).diff(DateTime.fromISO(primeiroDia), 'days').days >= 366)
        return erro(400, 'VALIDACAO', 'fim: O período pode ter no máximo 366 dias.')
      const ocorrencias = ocorrenciasDoPeriodo(u.id, primeiroDia, ultimoDia, q.get('tipo'))
      return HttpResponse.json(ocorrencias)
    }),
  ),

  http.get(
    `${API_URL}/eventos/:id`,
    autenticado(({ params }, u) => {
      const e = doUsuario(u.id, String(params.id))
      return e ? HttpResponse.json(serie(e)) : naoEncontrado('Evento')
    }),
  ),

  http.post(
    `${API_URL}/eventos`,
    autenticado(async ({ request }, u) => {
      const resultado = validar((await request.json()) as Partial<EventoCorpo>)
      if (resultado instanceof Response) return resultado
      const agora = agoraISO()
      const evento: EventoMock = {
        ...normalizarInstantes(resultado),
        id: crypto.randomUUID(),
        usuarioId: u.id,
        criadoEm: agora,
        atualizadoEm: agora,
      }
      banco.eventos.push(evento)
      return HttpResponse.json(serie(evento), { status: 201 })
    }),
  ),

  http.put(
    `${API_URL}/eventos/:id`,
    autenticado(async ({ request, params }, u) => {
      const evento = doUsuario(u.id, String(params.id))
      if (!evento) return naoEncontrado('Evento')
      const resultado = validar((await request.json()) as Partial<EventoCorpo>)
      if (resultado instanceof Response) return resultado
      Object.assign(evento, normalizarInstantes(resultado), { atualizadoEm: agoraISO() })
      return HttpResponse.json(serie(evento))
    }),
  ),

  http.delete(
    `${API_URL}/eventos/:id`,
    autenticado(({ params }, u) => {
      const indice = banco.eventos.findIndex((e) => e.id === String(params.id) && e.usuarioId === u.id)
      if (indice < 0) return naoEncontrado('Evento')
      banco.eventos.splice(indice, 1)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
