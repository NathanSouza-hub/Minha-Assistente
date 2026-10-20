// Tarefas avulsas: mesmas regras de src/modules/tarefas/service.js (ordem por data, hora e título;
// concluir guarda quando e de novo mantém; atrasada = pendente com data antes de hoje).
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { deDataHoraISO, hojeISO } from '@/lib/datas'
import type { Tarefa, TarefaCorpo } from '@/lib/tipos'
import { agoraISO, banco, type TarefaMock } from './banco'
import { autenticado, erro, naoEncontrado } from './util'

const idDe = (params: Record<string, unknown>) => String(params.id)
const daUsuaria = (usuarioId: string, id: string) => banco.tarefas.find((t) => t.id === id && t.usuarioId === usuarioId)
const naoEncontrada = () => naoEncontrado('Tarefa', { feminino: true })

export function paraResposta({ usuarioId: _u, ...t }: TarefaMock): Tarefa {
  return { ...t, concluida: t.concluidaEm !== null, atrasada: t.concluidaEm === null && t.data < hojeISO() }
}

const ordenar = (a: TarefaMock, b: TarefaMock) =>
  a.data.localeCompare(b.data) || (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') || a.titulo.localeCompare(b.titulo)

// Dia da conclusão no fuso de São Paulo (como `concluida_em::date` na sessão do banco).
const diaDaConclusao = (t: TarefaMock) => (t.concluidaEm ? deDataHoraISO(t.concluidaEm).toISODate() : null)

/** Para a tela Hoje (mocks/hoje.ts): as do dia e, olhando hoje, as atrasadas abertas e as concluídas hoje. */
export function tarefasAvulsasDoDia(usuarioId: string, data: string) {
  const ehHoje = data === hojeISO()
  return banco.tarefas
    .filter((t) => t.usuarioId === usuarioId)
    .filter((t) => t.data === data || (ehHoje && t.data < data && (t.concluidaEm === null || diaDaConclusao(t) === data)))
    .sort(ordenar)
    .map(paraResposta)
}

export function concluirTarefa(usuarioId: string, id: string, concluida: boolean) {
  const t = daUsuaria(usuarioId, id)
  if (!t) return null
  t.concluidaEm = concluida ? (t.concluidaEm ?? agoraISO()) : null
  return t
}

function validar(corpo: Partial<TarefaCorpo>) {
  if (!corpo.titulo?.trim()) return 'titulo: Informe a tarefa.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corpo.data ?? '')) return 'data: Data inválida: use o formato AAAA-MM-DD.'
  if (corpo.lembrete && !corpo.hora) return 'hora: Para receber lembrete, informe a hora.'
  return null
}

const limpar = (c: TarefaCorpo): TarefaCorpo => ({
  titulo: c.titulo.trim(),
  detalhes: c.detalhes?.trim() || null,
  data: c.data,
  hora: c.hora || null,
  lembrete: Boolean(c.lembrete),
})

export const handlersTarefas = [
  http.get(
    `${API_URL}/tarefas`,
    autenticado(({ request }, u) => {
      const q = new URL(request.url).searchParams
      const lista = banco.tarefas
        .filter((t) => t.usuarioId === u.id)
        .filter((t) => !q.get('inicio') || t.data >= q.get('inicio')!)
        .filter((t) => !q.get('fim') || t.data <= q.get('fim')!)
        .filter((t) => q.get('situacao') !== 'pendente' || t.concluidaEm === null)
        .filter((t) => q.get('situacao') !== 'concluida' || t.concluidaEm !== null)
        .sort(ordenar)
        .map(paraResposta)
      return HttpResponse.json(lista)
    }),
  ),

  http.post(
    `${API_URL}/tarefas`,
    autenticado(async ({ request }, u) => {
      const corpo = (await request.json()) as TarefaCorpo
      const problema = validar(corpo)
      if (problema) return erro(400, 'VALIDACAO', problema)
      const agora = agoraISO()
      const nova: TarefaMock = {
        id: crypto.randomUUID(),
        usuarioId: u.id,
        concluidaEm: null,
        criadoEm: agora,
        atualizadoEm: agora,
        ...limpar(corpo),
      }
      banco.tarefas.push(nova)
      return HttpResponse.json(paraResposta(nova), { status: 201 })
    }),
  ),

  http.get(
    `${API_URL}/tarefas/:id`,
    autenticado(({ params }, u) => {
      const t = daUsuaria(u.id, idDe(params))
      return t ? HttpResponse.json(paraResposta(t)) : naoEncontrada()
    }),
  ),

  http.put(
    `${API_URL}/tarefas/:id`,
    autenticado(async ({ request, params }, u) => {
      const t = daUsuaria(u.id, idDe(params))
      if (!t) return naoEncontrada()
      const corpo = (await request.json()) as TarefaCorpo
      const problema = validar(corpo)
      if (problema) return erro(400, 'VALIDACAO', problema)
      Object.assign(t, limpar(corpo), { atualizadoEm: agoraISO() })
      return HttpResponse.json(paraResposta(t))
    }),
  ),

  http.delete(
    `${API_URL}/tarefas/:id`,
    autenticado(({ params }, u) => {
      const t = daUsuaria(u.id, idDe(params))
      if (!t) return naoEncontrada()
      banco.tarefas = banco.tarefas.filter((x) => x.id !== t.id)
      banco.registrosTarefa = banco.registrosTarefa.filter((r) => !(r.categoria === 'tarefa' && r.itemId === t.id))
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.patch(
    `${API_URL}/tarefas/:id/concluir`,
    autenticado(async ({ request, params }, u) => {
      const texto = await request.text()
      const { concluida = true } = (texto ? JSON.parse(texto) : {}) as { concluida?: boolean }
      const t = concluirTarefa(u.id, idDe(params), concluida)
      return t ? HttpResponse.json(paraResposta(t)) : naoEncontrada()
    }),
  ),
]
