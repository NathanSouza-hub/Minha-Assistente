// Consultas e mutações de pagamentos, imóveis, categorias e relatório de gastos.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, baixarArquivo } from '@/lib/api'
import { salvarNoAparelho } from '@/lib/arquivos'
import { invalidarPainel } from './hoje'
import type {
  AgruparGastosPor,
  CategoriaPagamento,
  Comprovante,
  FiltrosPagamento,
  Imovel,
  Pagamento,
  PagamentoCriacao,
  PagamentoDetalhe,
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

// Categorias são de cada usuário (as 5 padrão nascem no cadastro); cada uma é uma aba de Contas.
export const useCategorias = () =>
  useQuery({
    queryKey: chaves.categorias,
    queryFn: () => api<CategoriaPagamento[]>('/categorias-pagamento'),
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
    queryFn: () => api<PagamentoDetalhe>(`/pagamentos/${id}`),
    enabled: Boolean(id),
  })

/** Muda os comprovantes no detalhe em cache e recarrega as listas (que mostram a contagem). */
function useMudarComprovantes(pagamentoId: string) {
  const cliente = useQueryClient()
  return (mudar: (lista: Comprovante[]) => Comprovante[]) => {
    cliente.setQueryData<PagamentoDetalhe>(chaves.pagamento(pagamentoId), (p) => {
      if (!p) return p
      const comprovantes = mudar(p.comprovantes)
      return { ...p, comprovantes, totalComprovantes: comprovantes.length }
    })
    return cliente.invalidateQueries({ queryKey: ['pagamentos', 'lista'] })
  }
}

export function useEnviarComprovante(pagamentoId: string) {
  const mudar = useMudarComprovantes(pagamentoId)
  return useMutation({
    mutationFn: (arquivo: File) => {
      const formulario = new FormData()
      formulario.append('arquivo', arquivo)
      return api<Comprovante>(`/pagamentos/${pagamentoId}/comprovantes`, { method: 'POST', corpo: formulario })
    },
    // A tela avisa com o nome do arquivo (podem ser vários de uma vez).
    meta: { semAviso: true },
    onSuccess: (comprovante) => mudar((lista) => [...lista, comprovante]),
  })
}

export function useExcluirComprovante(pagamentoId: string) {
  const mudar = useMudarComprovantes(pagamentoId)
  return useMutation({
    mutationFn: (comprovanteId: string) =>
      api<void>(`/pagamentos/${pagamentoId}/comprovantes/${comprovanteId}`, { method: 'DELETE' }),
    onSuccess: (_r, comprovanteId) => mudar((lista) => lista.filter((c) => c.id !== comprovanteId)),
  })
}

/** Baixa o comprovante e entrega ao navegador com o nome original. */
export const useBaixarComprovante = (pagamentoId: string) =>
  useMutation({
    mutationFn: async (comprovante: Comprovante) =>
      salvarNoAparelho(
        await baixarArquivo(`/pagamentos/${pagamentoId}/comprovantes/${comprovante.id}`),
        comprovante.nomeOriginal,
      ),
  })

export const useRelatorioGastos = (periodo: { inicio: string; fim: string; agruparPor: AgruparGastosPor }) =>
  useQuery({
    queryKey: [...chaves.relatorio, periodo],
    queryFn: () => api<RelatorioGastos>('/relatorios/gastos', { query: periodo }),
    placeholderData: (anterior) => anterior,
  })

/** Tudo que depende de pagamentos (listas, itens, relatório e, pela fatura, os cartões). */
function useInvalidarPagamentos() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chaves.pagamentos }),
      cliente.invalidateQueries({ queryKey: ['cartoes'] }),
      cliente.invalidateQueries({ queryKey: chaves.relatorio }),
      invalidarPainel(cliente),
    ])
}

/**
 * Aplica a mudança direto nas listas em cache antes de recarregar: ao voltar para a lista, a
 * pessoa já vê o resultado (sem o item excluído "piscar" enquanto a nova busca não chega).
 */
function useAtualizarListas() {
  const cliente = useQueryClient()
  return (mudar: (lista: Pagamento[]) => Pagamento[]) =>
    cliente.setQueriesData<Pagamento[]>(
      { queryKey: ['pagamentos', 'lista'] },
      (lista) => lista && mudar(lista),
    )
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

/**
 * Marca como pago com a data de hoje. Recorrente: o back-end cria a próxima ocorrência. Na conta
 * da equipe dá para mandar o valor pago (obrigatório quando estava a definir).
 */
export function usePagarPagamento() {
  const invalidar = useInvalidarPagamentos()
  return useMutation({
    mutationFn: ({ id, valorCentavos }: { id: string; valorCentavos?: number }) =>
      api<Pagamento>(`/pagamentos/${id}/pagar`, {
        method: 'PATCH',
        corpo: valorCentavos ? { valorCentavos } : undefined,
      }),
    onSettled: invalidar,
  })
}

export function useExcluirPagamento() {
  const cliente = useQueryClient()
  const invalidar = useInvalidarPagamentos()
  const atualizarListas = useAtualizarListas()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/pagamentos/${id}`, { method: 'DELETE' }),
    onSuccess: (_resposta, id) => {
      // Sai do cache antes de recarregar, para a tela ainda aberta não buscar de novo (404).
      cliente.removeQueries({ queryKey: chaves.pagamento(id) })
      atualizarListas((lista) => lista.filter((p) => p.id !== id))
      return invalidar()
    },
  })
}

function useInvalidarCategorias() {
  const cliente = useQueryClient()
  // Nome da categoria aparece nos pagamentos, no relatório e no painel.
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chaves.categorias }),
      cliente.invalidateQueries({ queryKey: chaves.pagamentos }),
      cliente.invalidateQueries({ queryKey: chaves.relatorio }),
      invalidarPainel(cliente),
    ])
}

/** Cria (sem id) ou renomeia/reordena uma categoria. Já põe a resposta na lista em cache. */
export function useSalvarCategoria() {
  const cliente = useQueryClient()
  const invalidar = useInvalidarCategorias()
  return useMutation({
    mutationFn: ({ id, ...dados }: { id?: string; nome?: string; ordem?: number }) =>
      id
        ? api<CategoriaPagamento>(`/categorias-pagamento/${id}`, { method: 'PUT', corpo: dados })
        : api<CategoriaPagamento>('/categorias-pagamento', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: (salva) => {
      cliente.setQueryData<CategoriaPagamento[]>(chaves.categorias, (lista) =>
        lista && [...lista.filter((c) => c.id !== salva.id), salva].sort((a, b) => a.ordem - b.ordem),
      )
      return invalidar()
    },
  })
}

export function useExcluirCategoria() {
  const invalidar = useInvalidarCategorias()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/categorias-pagamento/${id}`, { method: 'DELETE' }),
    onSuccess: invalidar,
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
      invalidarPainel(cliente),
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
