// Consultas e mutações das tarefas avulsas. Elas aparecem na tela Hoje e no painel: toda mudança
// recarrega os dois (invalidarPainel).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FiltrosTarefa, Tarefa, TarefaCorpo } from '@/lib/tipos'
import { invalidarPainel } from './hoje'
import { invalidarProdutividade } from './produtividade'

export const chavesTarefas = {
  todas: ['tarefas'] as const,
  lista: (filtros: FiltrosTarefa) => ['tarefas', 'lista', filtros] as const,
  item: (id: string) => ['tarefas', 'item', id] as const,
}

export const useTarefas = (filtros: FiltrosTarefa) =>
  useQuery({
    queryKey: chavesTarefas.lista(filtros),
    queryFn: () => api<Tarefa[]>('/tarefas', { query: filtros }),
    placeholderData: (anterior) => anterior,
  })

export const useTarefa = (id: string | undefined) =>
  useQuery({
    queryKey: chavesTarefas.item(id ?? ''),
    queryFn: () => api<Tarefa>(`/tarefas/${id}`),
    enabled: Boolean(id),
  })

function useInvalidar() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chavesTarefas.todas }),
      invalidarPainel(cliente),
      invalidarProdutividade(cliente),
    ])
}

export function useSalvarTarefa() {
  const invalidar = useInvalidar()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: TarefaCorpo }) =>
      id
        ? api<Tarefa>(`/tarefas/${id}`, { method: 'PUT', corpo: dados })
        : api<Tarefa>('/tarefas', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: (salva) => {
      cliente.setQueryData(chavesTarefas.item(salva.id), salva)
      return invalidar()
    },
  })
}

export function useExcluirTarefa() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/tarefas/${id}`, { method: 'DELETE' }),
    onSuccess: invalidar,
  })
}

/** Conclui ou reabre. */
export function useConcluirTarefa() {
  const invalidar = useInvalidar()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      api<Tarefa>(`/tarefas/${id}/concluir`, { method: 'PATCH', corpo: { concluida } }),
    onSuccess: (tarefa) => {
      cliente.setQueryData(chavesTarefas.item(tarefa.id), tarefa)
      return invalidar()
    },
  })
}
