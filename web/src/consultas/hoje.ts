// Tarefas do dia (tela Hoje): o que ocorre no dia em cada área, numa lista só, com ✓/✗.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MarcacaoTarefa, TarefaHoje, TarefasHoje } from '@/lib/tipos'

export const chavesHoje = {
  todos: ['hoje'] as const,
  dia: (data: string) => ['hoje', data] as const,
}

export const useTarefasHoje = (data: string) =>
  useQuery({
    queryKey: chavesHoje.dia(data),
    queryFn: () => api<TarefasHoje>('/hoje', { query: { data } }),
  })

/** Recarrega a tela Hoje: qualquer mudança em agendamentos, remédios, compromissos, viagens ou contas a afeta. */
export const invalidarPainel = (cliente: QueryClient) =>
  cliente.invalidateQueries({ queryKey: chavesHoje.todos })

const CHAVE_MARCAR = ['hoje', 'marcar'] as const

const contar = (tarefas: TarefaHoje[], status: TarefaHoje['status']) =>
  tarefas.filter((t) => t.status === status).length

/** Mesmas contas do back-end, para o resumo acompanhar a marcação otimista. */
export const resumir = (tarefas: TarefaHoje[]): TarefasHoje['resumo'] => ({
  programadas: tarefas.length,
  concluidas: contar(tarefas, 'feito'),
  pendentes: contar(tarefas, 'pendente'),
  atrasadas: contar(tarefas, 'atrasado'),
})

/**
 * ✓, ✗ ou desfazer. Otimista: a linha e o resumo mudam na hora e voltam atrás se o servidor
 * recusar. O ✓ de remédio, compromisso e despesa vale na área (tomado, feito, pago).
 */
export function useMarcarTarefa(data: string) {
  const cliente = useQueryClient()
  const chave = chavesHoje.dia(data)
  const trocar = (id: string, mudar: (t: TarefaHoje) => TarefaHoje) =>
    cliente.setQueryData<TarefasHoje>(chave, (dia) => {
      if (!dia) return dia
      const tarefas = dia.tarefas.map((t) => (t.id === id ? mudar(t) : t))
      return { ...dia, tarefas, resumo: resumir(tarefas) }
    })

  return useMutation({
    mutationKey: CHAVE_MARCAR,
    mutationFn: ({ tarefa, status }: { tarefa: TarefaHoje; status: MarcacaoTarefa }) =>
      api<TarefaHoje>(`/hoje/${encodeURIComponent(tarefa.id)}`, { method: 'PATCH', corpo: { status } }),
    onMutate: async ({ tarefa, status }) => {
      await cliente.cancelQueries({ queryKey: chave })
      const anterior = cliente.getQueryData<TarefasHoje>(chave)
      // Ao desfazer, o servidor diz se volta como pendente ou atrasada.
      trocar(tarefa.id, (t) => ({ ...t, status }))
      return { anterior }
    },
    onError: (_erro, _vars, contexto) => cliente.setQueryData(chave, contexto?.anterior),
    onSuccess: (atualizada) => trocar(atualizada.id, () => atualizada),
    // As áreas (remédios, compromissos, contas, relatório) mostram o mesmo estado: tudo fica
    // desatualizado e é buscado de novo ao abrir (só a tela aberta busca agora). Com vários
    // toques seguidos, espera o último: a busca não desfaz a marcação otimista dos outros.
    onSettled: () => {
      if (cliente.isMutating({ mutationKey: CHAVE_MARCAR }) === 1) return cliente.invalidateQueries()
    },
  })
}
