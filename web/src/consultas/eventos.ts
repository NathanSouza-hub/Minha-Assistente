// Consultas e mutações da agenda.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { invalidarPainel } from './hoje'
import type { Evento, EventoCorpo, FiltrosEvento } from '@/lib/tipos'

export const chavesEventos = {
  todos: ['eventos'] as const,
  lista: (filtros: FiltrosEvento) => ['eventos', 'lista', filtros] as const,
  item: (id: string) => ['eventos', 'item', id] as const,
}

/** Ocorrências no período (dias inclusive). Sem período, a API usa hoje + 30 dias. */
export const useEventos = (filtros: FiltrosEvento) =>
  useQuery({
    queryKey: chavesEventos.lista(filtros),
    queryFn: () => api<Evento[]>('/eventos', { query: filtros }),
    placeholderData: (anterior) => anterior,
  })

/** A série como foi cadastrada (inicio = início da primeira ocorrência). */
export const useEvento = (id: string | undefined) =>
  useQuery({
    queryKey: chavesEventos.item(id ?? ''),
    queryFn: () => api<Evento>(`/eventos/${id}`),
    enabled: Boolean(id),
  })

function useInvalidarEventos() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([cliente.invalidateQueries({ queryKey: chavesEventos.todos }), invalidarPainel(cliente)])
}

export function useSalvarEvento() {
  const invalidar = useInvalidarEventos()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: EventoCorpo }) =>
      id
        ? api<Evento>(`/eventos/${id}`, { method: 'PUT', corpo: dados })
        : api<Evento>('/eventos', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: invalidar,
  })
}

export function useExcluirEvento() {
  const cliente = useQueryClient()
  const invalidar = useInvalidarEventos()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/eventos/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      // O item apagado sai do cache antes de recarregar: senão a tela ainda aberta dele buscaria
      // de novo e receberia 404 (aviso de erro logo depois de "excluído").
      cliente.removeQueries({ queryKey: chavesEventos.item(id) })
      // Tira todas as ocorrências da série das listas já em cache (sem "piscar" ao voltar).
      cliente.setQueriesData<Evento[]>({ queryKey: ['eventos', 'lista'] }, (lista) =>
        lista?.filter((e) => e.id !== id),
      )
      return invalidar()
    },
  })
}
