// Cartões de crédito, faturas e compras. A fatura de cada mês é uma conta em /pagamentos que o
// back-end mantém sozinho; por isso toda mutação aqui também recarrega contas, relatório e painel.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Cartao, CartaoCorpo, CompraCartao, CompraCartaoCorpo, Fatura, Pagamento } from '@/lib/tipos'
import { invalidarPainel } from './hoje'
import { chaves as chavesPagamentos } from './pagamentos'

export const chaves = {
  cartoes: ['cartoes'] as const,
  lista: ['cartoes', 'lista'] as const,
  /** mes = "AAAA-MM" */
  fatura: (cartaoId: string, mes: string) => ['cartoes', 'fatura', cartaoId, mes] as const,
  compra: (cartaoId: string, compraId: string) => ['cartoes', 'compra', cartaoId, compraId] as const,
}

export const useCartoes = () => useQuery({ queryKey: chaves.lista, queryFn: () => api<Cartao[]>('/cartoes') })

export const useFatura = (cartaoId: string | undefined, mes: string) =>
  useQuery({
    queryKey: chaves.fatura(cartaoId ?? '', mes),
    queryFn: () => api<Fatura>(`/cartoes/${cartaoId}/faturas/${mes}`),
    enabled: Boolean(cartaoId),
    // Ao trocar de mês, mantém a fatura anterior na tela até a nova chegar.
    placeholderData: (anterior) => anterior,
  })

export const useCompraCartao = (cartaoId: string, compraId: string | undefined) =>
  useQuery({
    queryKey: chaves.compra(cartaoId, compraId ?? ''),
    queryFn: () => api<CompraCartao>(`/cartoes/${cartaoId}/compras/${compraId}`),
    enabled: Boolean(compraId),
  })

function useInvalidarCartoes() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chaves.cartoes }),
      cliente.invalidateQueries({ queryKey: chavesPagamentos.pagamentos }),
      cliente.invalidateQueries({ queryKey: chavesPagamentos.relatorio }),
      invalidarPainel(cliente),
    ])
}

/** Cria (sem id) ou edita um cartão. Já põe a resposta na lista em cache. */
export function useSalvarCartao() {
  const cliente = useQueryClient()
  const invalidar = useInvalidarCartoes()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: CartaoCorpo }) =>
      id
        ? api<Cartao>(`/cartoes/${id}`, { method: 'PUT', corpo: dados })
        : api<Cartao>('/cartoes', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: (salvo) => {
      cliente.setQueryData<Cartao[]>(chaves.lista, (lista) =>
        lista && [...lista.filter((c) => c.id !== salvo.id), salvo].sort((a, b) => a.ordem - b.ordem),
      )
      return invalidar()
    },
  })
}

export function useExcluirCartao() {
  const cliente = useQueryClient()
  const invalidar = useInvalidarCartoes()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/cartoes/${id}`, { method: 'DELETE' }),
    onSuccess: (_resposta, id) => {
      cliente.setQueryData<Cartao[]>(chaves.lista, (lista) => lista?.filter((c) => c.id !== id))
      return invalidar()
    },
  })
}

/** Cria (sem compraId) ou edita uma compra; a API recalcula as faturas. */
export function useSalvarCompra() {
  const invalidar = useInvalidarCartoes()
  return useMutation({
    mutationFn: ({ cartaoId, compraId, dados }: { cartaoId: string; compraId?: string; dados: CompraCartaoCorpo }) =>
      compraId
        ? api<CompraCartao>(`/cartoes/${cartaoId}/compras/${compraId}`, { method: 'PUT', corpo: dados })
        : api<CompraCartao>(`/cartoes/${cartaoId}/compras`, { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: invalidar,
  })
}

export function useExcluirCompra() {
  const cliente = useQueryClient()
  const invalidar = useInvalidarCartoes()
  return useMutation({
    mutationFn: ({ cartaoId, compraId }: { cartaoId: string; compraId: string }) =>
      api<void>(`/cartoes/${cartaoId}/compras/${compraId}`, { method: 'DELETE' }),
    onSuccess: (_resposta, { cartaoId, compraId }) => {
      cliente.removeQueries({ queryKey: chaves.compra(cartaoId, compraId) })
      return invalidar()
    },
  })
}

/** Paga a conta da fatura (PATCH /pagamentos/:id/pagar) e atualiza cartões e contas. */
export function usePagarFatura() {
  const invalidar = useInvalidarCartoes()
  return useMutation({
    mutationFn: (pagamentoId: string) => api<Pagamento>(`/pagamentos/${pagamentoId}/pagar`, { method: 'PATCH' }),
    onSettled: invalidar,
  })
}
