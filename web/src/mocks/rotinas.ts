// Rotina — regras espelhando src/modules/rotinas do back-end (etapa 7).
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { deDataISO, hojeISO } from '@/lib/datas'
import type { ItemHistoricoRotina, Rotina, RotinaCorpo, TarefaDoDia } from '@/lib/tipos'
import { agoraISO, banco, type RotinaMock } from './banco'
import { autenticado, erro, naoEncontrado } from './util'

/** 0 = domingo ... 6 = sábado. */
const diaDaSemana = (data: string) => deDataISO(data).weekday % 7

// Ordem manual primeiro; depois quem tem hora (pela hora) e por fim as sem hora.
const ordenar = (
  a: Pick<Rotina, 'ordem' | 'hora' | 'titulo'>,
  b: Pick<Rotina, 'ordem' | 'hora' | 'titulo'>,
) =>
  a.ordem - b.ordem ||
  (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') ||
  a.titulo.localeCompare(b.titulo)

const publico = ({ usuarioId: _u, ...r }: RotinaMock): Rotina => ({
  ...r,
  diasSemana: [...r.diasSemana].sort(),
})

function tarefa(r: RotinaMock, data: string): TarefaDoDia {
  const conclusao = banco.conclusoesRotina.find((c) => c.rotinaId === r.id && c.data === data)
  return {
    rotinaId: r.id,
    titulo: r.titulo,
    hora: r.hora,
    ordem: r.ordem,
    data,
    concluida: Boolean(conclusao),
    concluidaEm: conclusao?.concluidaEm ?? null,
  }
}

function validar(c: Partial<RotinaCorpo>) {
  const problemas: string[] = []
  if (!c.titulo?.trim()) problemas.push('titulo: Informe o título da tarefa.')
  if (c.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.hora)) problemas.push('hora: Hora inválida: use HH:MM.')
  const dias = c.diasSemana ?? [0, 1, 2, 3, 4, 5, 6]
  if (dias.length === 0) problemas.push('diasSemana: Escolha pelo menos um dia.')
  if (dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) problemas.push('diasSemana: Dia inválido.')
  if (c.lembrete && !c.hora) problemas.push('hora: Para receber lembrete, informe a hora.')
  return problemas.length ? erro(400, 'VALIDACAO', problemas.join('; ')) : null
}

const gravaveis = (c: RotinaCorpo) => ({
  titulo: c.titulo.trim(),
  hora: c.hora || null,
  diasSemana: [...new Set(c.diasSemana ?? [0, 1, 2, 3, 4, 5, 6])],
  ativo: c.ativo ?? true,
  lembrete: Boolean(c.lembrete),
  observacoes: c.observacoes?.trim() || null,
  ...(c.ordem !== undefined && { ordem: c.ordem }),
})

const doUsuario = (usuarioId: string, id: string) =>
  banco.rotinas.find((r) => r.id === id && r.usuarioId === usuarioId)

/** Tarefas ativas do dia da semana — o mesmo que doDia() no back-end. */
export function tarefasDoDia(usuarioId: string, data: string) {
  const dia = diaDaSemana(data)
  return banco.rotinas
    .filter((r) => r.usuarioId === usuarioId && r.ativo && r.diasSemana.includes(dia))
    .sort(ordenar)
    .map((r) => tarefa(r, data))
}

export const handlersRotinas = [
  http.get(
    `${API_URL}/rotinas/hoje`,
    autenticado(({ request }, u) => {
      const data = new URL(request.url).searchParams.get('data') ?? hojeISO()
      return HttpResponse.json(tarefasDoDia(u.id, data))
    }),
  ),

  http.post(
    `${API_URL}/rotinas/:id/concluir`,
    autenticado(async ({ request, params }, u) => {
      const r = doUsuario(u.id, String(params.id))
      if (!r) return naoEncontrado('Tarefa', { feminino: true })
      const { data = hojeISO(), concluida = true } = (await request.json().catch(() => ({}))) as {
        data?: string
        concluida?: boolean
      }
      if (!r.diasSemana.includes(diaDaSemana(data)))
        return erro(400, 'VALIDACAO', 'data: esta tarefa não é feita nesse dia da semana.')
      const indice = banco.conclusoesRotina.findIndex((c) => c.rotinaId === r.id && c.data === data)
      if (concluida && indice < 0)
        banco.conclusoesRotina.push({ rotinaId: r.id, data, concluidaEm: agoraISO() })
      if (!concluida && indice >= 0) banco.conclusoesRotina.splice(indice, 1)
      return HttpResponse.json(tarefa(r, data))
    }),
  ),

  // Histórico: conclusões + o ✗ da tela Hoje (o feito vale mais), do mais recente — como o back-end.
  http.get(
    `${API_URL}/rotinas/:id/historico`,
    autenticado(({ request, params }, u) => {
      const r = doUsuario(u.id, String(params.id))
      if (!r) return naoEncontrado('Tarefa', { feminino: true })
      const busca = new URL(request.url).searchParams
      const fim = busca.get('fim') ?? hojeISO()
      const inicio = busca.get('inicio') ?? deDataISO(fim).minus({ days: 60 }).toISODate()!
      const dentro = (d: string) => d >= inicio && d <= fim
      const feitos: ItemHistoricoRotina[] = banco.conclusoesRotina
        .filter((c) => c.rotinaId === r.id && dentro(c.data))
        .map((c) => ({ data: c.data, situacao: 'feito', em: c.concluidaEm }))
      const naoFeitos: ItemHistoricoRotina[] = banco.registrosTarefa
        .filter(
          (t) =>
            t.usuarioId === u.id &&
            t.categoria === 'compromisso' &&
            t.itemId === r.id &&
            t.status === 'nao_feito' &&
            dentro(t.dataOcorrencia) &&
            !feitos.some((f) => f.data === t.dataOcorrencia),
        )
        .map((t) => ({ data: t.dataOcorrencia, situacao: 'nao_feito', em: agoraISO() }))
      return HttpResponse.json([...feitos, ...naoFeitos].sort((a, b) => b.data.localeCompare(a.data)))
    }),
  ),

  http.get(
    `${API_URL}/rotinas`,
    autenticado((_ctx, u) =>
      HttpResponse.json(
        banco.rotinas
          .filter((r) => r.usuarioId === u.id)
          .sort(ordenar)
          .map(publico),
      ),
    ),
  ),

  http.post(
    `${API_URL}/rotinas`,
    autenticado(async ({ request }, u) => {
      const corpo = (await request.json()) as RotinaCorpo
      const invalido = validar(corpo)
      if (invalido) return invalido
      const agora = agoraISO()
      const rotina: RotinaMock = {
        id: crypto.randomUUID(),
        usuarioId: u.id,
        ordem: 0,
        ...gravaveis(corpo),
        criadoEm: agora,
        atualizadoEm: agora,
      }
      banco.rotinas.push(rotina)
      return HttpResponse.json(publico(rotina), { status: 201 })
    }),
  ),

  http.put(
    `${API_URL}/rotinas/:id`,
    autenticado(async ({ request, params }, u) => {
      const r = doUsuario(u.id, String(params.id))
      if (!r) return naoEncontrado('Tarefa', { feminino: true })
      const corpo = (await request.json()) as RotinaCorpo
      const invalido = validar(corpo)
      if (invalido) return invalido
      Object.assign(r, gravaveis(corpo), { atualizadoEm: agoraISO() })
      return HttpResponse.json(publico(r))
    }),
  ),

  http.delete(
    `${API_URL}/rotinas/:id`,
    autenticado(({ params }, u) => {
      const indice = banco.rotinas.findIndex((r) => r.id === String(params.id) && r.usuarioId === u.id)
      if (indice < 0) return naoEncontrado('Tarefa', { feminino: true })
      const [apagada] = banco.rotinas.splice(indice, 1)
      banco.conclusoesRotina = banco.conclusoesRotina.filter((c) => c.rotinaId !== apagada.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
