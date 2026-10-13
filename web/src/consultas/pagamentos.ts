// Consultas e mutações de pagamentos, imóveis, categorias e relatório de gastos.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  AgruparGastosPor,
  CategoriaPagamento,
  FiltrosPagamento,
  Imovel,
  Pagamento,
  PagamentoCriacao,
  PagamentoEdicao,
  RelatorioGastos,
} from '@/lib/tipos'

export const chaves = {
  categorias: ['categorias-pagamento'] as const,
  imoveis: ['imoveis'] as const,
  pagamentos: ['pagamentos'] as const,
  listaPagamentos: (filtros: FiltrosPagamento) => ['pagamentos', 'lista', filtros] as const,
  pagamento: (id: string) => ['pagamentos', 'item', id] as const,
  relatorio: ['relatorios', 'gastos'] as const,
}

// Categorias são fixas (seed do back-end): uma busca por sessão basta.
export const useCategorias = () =>
  useQuery({
    queryKey: chaves.categorias,
    queryFn: () => api<CategoriaPagamento[]>('/categorias-pagamento'),
    staleTime: Infinity,
  })

export const useImoveis = () =>
  useQuery({ queryKey: chaves.imoveis, queryFn: () => api<Imovel[]>('/imoveis') })

export const usePagamentos = (filtros: FiltrosPagamento) =>
  useQuery({
    queryKey: chaves.listaPagamentos(filtros),
    queryFn: () => api<Pagamento[]>('/pagamentos', { query: filtros }),
    // Ao trocar de mês/filtro, mantém a lista anterior na tela até a nova chegar.
    placeholderData: (anterior) => anterior,
  })

export const usePagamento = (id: string | undefined) =>
  useQuery({
    queryKey: chaves.pagamento(id ?? ''),
    queryFn: () => api<Pagamento>(`/pagamentos/${id}`),
    enabled: Boolean(id),
  })

export const useRelatorioGastos = (periodo: { inicio: string; fim: string; agruparPor: AgruparGastosPor }) =>
  useQuery({
    queryKey: [...chaves.relatorio, periodo],
    queryFn: () => api<RelatorioGastos>('/relatorios/gastos', { query: periodo }),
    placeholderData: (anterior) => anterior,
  })

/** Tudo que depende de pagamentos (listas, itens, relatório). */
function useInvalidarPagamentos() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chaves.pagamentos }),
      cliente.invalidateQueries({ queryKey: chaves.relatorio }),
    ])
}

/**
 * Aplica a mudança direto nas listas em cache antes de recarregar: ao voltar para a lista, a
 * pessoa já vê o resultado (sem o item excluído "piscar" enquanto a nova busca não chega).
 */
function useAtualizarListas() {
  const cliente = useQueryClient()
  return (mudar: (lista: Pagamento[]) => Pagamento[]) =>
    cliente.setQueriesData<Pagamento[]>({ queryKey: ['pagamentos', 'lista'] }, (lista) => lista && mudar(lista))
}

export function useCriarPagamento() {
  const invalidar = useInvalidarPagamentos()
  return useMutation({
    // Com parcelamento a API devolve um array; sem, um objeto. Normaliza para array.
    mutationFn: async (dados: PagamentoCriacao) => {
      const resposta = await api<Pagamento | Pagamento[]>('/pagamentos', { method: 'POST', corpo: dados })
      return Array.isArray(resposta) ? resposta : [resposta]
    },
    meta: { semAviso: true },
    onSuccess: invalidar,
  })
}

export function useEditarPagamento() {
  const invalidar = useInvalidarPagamentos()
  const atualizarListas = useAtualizarListas()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: PagamentoEdicao }) =>
      api<Pagamento>(`/pagamentos/${id}`, { method: 'PUT', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: (salvo) => {
      atualizarListas((lista) => lista.map((p) => (p.id === salvo.id ? salvo : p)))
      return invalidar()
    },
  })
}

/** Igual a useEditarPagamento, mas avisando erros num toast (usado fora de formulários). */
export function useEditarPagamentoPorId() {
  const invalidar = useInvalidarPagamentos()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: PagamentoEdicao }) =>
      api<Pagamento>(`/pagamentos/${id}`, { method: 'PUT', corpo: dados }),
    onSettled: invalidar,
  })
}

/** Marca como pago com a data de hoje. Recorrente: o back-end cria a próxima ocorrência. */
export function usePagarPagamento() {
  const invalidar = useInvalidarPagamentos()
  return useMutation({
    mutationFn: (id: string) => api<Pagamento>(`/pagamentos/${id}/pagar`, { method: 'PATCH' }),
    onSettled: invalidar,
  })
}

export function useExcluirPagamento() {
  const invalidar = useInvalidarPagamentos()
  const atualizarListas = useAtualizarListas()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/pagamentos/${id}`, { method: 'DELETE' }),
    onSuccess: (_resposta, id) => {
      atualizarListas((lista) => lista.filter((p) => p.id !== id))
      return invalidar()
    },
  })
}

function useInvalidarImoveis() {
  const cliente = useQueryClient()
  // Nome do imóvel aparece nos pagamentos e no relatório.
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chaves.imoveis }),
      cliente.invalidateQueries({ queryKey: chaves.pagamentos }),
      cliente.invalidateQueries({ queryKey: chaves.relatorio }),
    ])
}

export function useSalvarImovel() {
  const invalidar = useInvalidarImoveis()
  return useMutation({
    mutationFn: ({ id, nome }: { id?: string; nome: string }) =>
      id
        ? api<Imovel>(`/imoveis/${id}`, { method: 'PUT', corpo: { nome } })
        : api<Imovel>('/imoveis', { method: 'POST', corpo: { nome } }),
    meta: { semAviso: true },
    onSuccess: invalidar,
  })
}

export function useExcluirImovel() {
  const invalidar = useInvalidarImoveis()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/imoveis/${id}`, { method: 'DELETE' }),
    onSuccess: invalidar,
  })
}
