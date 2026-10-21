// Consultas e mutações da rotina.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { invalidarPainel } from './hoje'
import { agora, paraDataHoraISO } from '@/lib/datas'
import type { ItemHistoricoRotina, Rotina, RotinaCorpo, TarefaDoDia } from '@/lib/tipos'

export const chavesRotina = {
  todos: ['rotinas'] as const,
  lista: ['rotinas', 'lista'] as const,
  doDia: (data: string) => ['rotinas', 'dia', data] as const,
  historico: (id: string) => ['rotinas', 'historico', id] as const,
}

/** Últimos 60 dias em que o compromisso foi marcado (feito ou não feito). */
export const useHistoricoRotina = (id: string) =>
  useQuery({
    queryKey: chavesRotina.historico(id),
    queryFn: () => api<ItemHistoricoRotina[]>(`/rotinas/${id}/historico`),
  })

export const useRotinas = () =>
  useQuery({ queryKey: chavesRotina.lista, queryFn: () => api<Rotina[]>('/rotinas') })

export const useTarefasDoDia = (data: string) =>
  useQuery({
    queryKey: chavesRotina.doDia(data),
    queryFn: () => api<TarefaDoDia[]>('/rotinas/hoje', { query: { data } }),
  })

/** Marca ou desmarca. Otimista: a tela muda na hora e volta atrás se o servidor recusar. */
export function useConcluirTarefa(data: string) {
  const cliente = useQueryClient()
  const chave = chavesRotina.doDia(data)
  // A tela Hoje mostra a mesma tarefa: ela é buscada de novo (onSettled).
  const trocar = (rotinaId: string, mudar: (t: TarefaDoDia) => TarefaDoDia) =>
    cliente.setQueryData<TarefaDoDia[]>(
      chave,
      (lista) => lista && lista.map((t) => (t.rotinaId === rotinaId ? mudar(t) : t)),
    )

  return useMutation({
    mutationFn: ({ rotinaId, concluida }: { rotinaId: string; concluida: boolean }) =>
      api<TarefaDoDia>(`/rotinas/${rotinaId}/concluir`, { method: 'POST', corpo: { data, concluida } }),
    onMutate: async ({ rotinaId, concluida }) => {
      await cliente.cancelQueries({ queryKey: chave })
      const anterior = cliente.getQueryData<TarefaDoDia[]>(chave)
      trocar(rotinaId, (t) => ({ ...t, concluida, concluidaEm: concluida ? paraDataHoraISO(agora()) : null }))
      return { anterior, rotinaId, concluidaAntes: !concluida }
    },
    onError: (_erro, _vars, contexto) => {
      cliente.setQueryData(chave, contexto?.anterior)
      if (contexto) trocar(contexto.rotinaId, (t) => ({ ...t, concluida: contexto.concluidaAntes }))
    },
    onSuccess: (atualizada) => trocar(atualizada.rotinaId, () => atualizada),
    onSettled: () => invalidarPainel(cliente),
  })
}

export function useSalvarRotina() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: RotinaCorpo }) =>
      id
        ? api<Rotina>(`/rotinas/${id}`, { method: 'PUT', corpo: dados })
        : api<Rotina>('/rotinas', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: (salva) => {
      cliente.setQueryData<Rotina[]>(
        chavesRotina.lista,
        (lista) =>
          lista &&
          (lista.some((r) => r.id === salva.id)
            ? lista.map((r) => (r.id === salva.id ? salva : r))
            : [...lista, salva]),
      )
      return Promise.all([
        cliente.invalidateQueries({ queryKey: chavesRotina.todos }),
        invalidarPainel(cliente),
      ])
    },
  })
}

export function useExcluirRotina() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/rotinas/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      cliente.setQueryData<Rotina[]>(chavesRotina.lista, (lista) => lista?.filter((r) => r.id !== id))
      return Promise.all([
        cliente.invalidateQueries({ queryKey: chavesRotina.todos }),
        invalidarPainel(cliente),
      ])
    },
  })
}
