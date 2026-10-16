// Equipe (quem recebe salário, plantão ou honorário). As contas de cada dia de pagamento são
// criadas pelo back-end em /pagamentos; por isso mudar a equipe recarrega contas, relatório e painel.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MembroEquipe, MembroEquipeCorpo } from '@/lib/tipos'
import { invalidarPainel } from './hoje'
import { chaves as chavesPagamentos } from './pagamentos'

export const chaves = { equipe: ['equipe'] as const }

export const useEquipe = () =>
  useQuery({ queryKey: chaves.equipe, queryFn: () => api<MembroEquipe[]>('/equipe') })

function useInvalidarEquipe() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chaves.equipe }),
      cliente.invalidateQueries({ queryKey: chavesPagamentos.pagamentos }),
      cliente.invalidateQueries({ queryKey: chavesPagamentos.relatorio }),
      invalidarPainel(cliente),
    ])
}

/** Cadastra (sem id) ou edita uma pessoa. Já põe a resposta na lista em cache. */
export function useSalvarMembro() {
  const cliente = useQueryClient()
  const invalidar = useInvalidarEquipe()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: MembroEquipeCorpo }) =>
      id
        ? api<MembroEquipe>(`/equipe/${id}`, { method: 'PUT', corpo: dados })
        : api<MembroEquipe>('/equipe', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: (salvo) => {
      cliente.setQueryData<MembroEquipe[]>(chaves.equipe, (lista) =>
        lista && [...lista.filter((m) => m.id !== salvo.id), salvo],
      )
      return invalidar()
    },
  })
}

export function useExcluirMembro() {
  const cliente = useQueryClient()
  const invalidar = useInvalidarEquipe()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/equipe/${id}`, { method: 'DELETE' }),
    onSuccess: (_resposta, id) => {
      cliente.setQueryData<MembroEquipe[]>(chaves.equipe, (lista) => lista?.filter((m) => m.id !== id))
      return invalidar()
    },
  })
}
