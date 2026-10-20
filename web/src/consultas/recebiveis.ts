// Consultas e mutações dos recebíveis (valores a receber) e dos recebimentos de cada um.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, baixarArquivo } from '@/lib/api'
import { salvarNoAparelho } from '@/lib/arquivos'
import type {
  Comprovante,
  FiltrosRecebivel,
  Recebivel,
  RecebivelCorpo,
  RecebivelDetalhe,
  RecebimentoCorpo,
} from '@/lib/tipos'
import { chaves as chavesPagamentos } from './pagamentos'

export const chavesRecebiveis = {
  todos: ['recebiveis'] as const,
  lista: (filtros: FiltrosRecebivel) => ['recebiveis', 'lista', filtros] as const,
  item: (id: string) => ['recebiveis', 'item', id] as const,
}

export const useRecebiveis = (filtros: FiltrosRecebivel) =>
  useQuery({
    queryKey: chavesRecebiveis.lista(filtros),
    queryFn: () => api<Recebivel[]>('/recebiveis', { query: filtros }),
    placeholderData: (anterior) => anterior,
  })

export const useRecebivel = (id: string | undefined) =>
  useQuery({
    queryKey: chavesRecebiveis.item(id ?? ''),
    queryFn: () => api<RecebivelDetalhe>(`/recebiveis/${id}`),
    enabled: Boolean(id),
  })

/** Listas, detalhes e os relatórios (entradas e saldo do painel) dependem dos recebíveis. */
function useInvalidar() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: chavesRecebiveis.todos }),
      cliente.invalidateQueries({ queryKey: chavesPagamentos.relatorio }),
    ])
}

export function useSalvarRecebivel() {
  const invalidar = useInvalidar()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: RecebivelCorpo }) =>
      id
        ? api<Recebivel>(`/recebiveis/${id}`, { method: 'PUT', corpo: dados })
        : api<Recebivel>('/recebiveis', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: (salvo) => {
      cliente.setQueryData<RecebivelDetalhe>(chavesRecebiveis.item(salvo.id), (atual) =>
        atual ? { ...atual, ...salvo } : atual,
      )
      return invalidar()
    },
  })
}

export function useExcluirRecebivel() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/recebiveis/${id}`, { method: 'DELETE' }),
    onSuccess: invalidar,
  })
}

/** Registra um recebimento (parcial ou total); a resposta já é o detalhe atualizado. */
export function useReceber(id: string) {
  const invalidar = useInvalidar()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (corpo: RecebimentoCorpo) =>
      api<RecebivelDetalhe>(`/recebiveis/${id}/recebimentos`, { method: 'POST', corpo }),
    meta: { semAviso: true },
    onSuccess: (detalhe) => {
      cliente.setQueryData(chavesRecebiveis.item(id), detalhe)
      return invalidar()
    },
  })
}

export function useDesfazerRecebimento(id: string) {
  const invalidar = useInvalidar()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (recebimentoId: string) =>
      api<RecebivelDetalhe>(`/recebiveis/${id}/recebimentos/${recebimentoId}`, { method: 'DELETE' }),
    onSuccess: (detalhe) => {
      cliente.setQueryData(chavesRecebiveis.item(id), detalhe)
      return invalidar()
    },
  })
}

/** Muda os comprovantes no detalhe em cache e recarrega as listas (que mostram a contagem). */
function useMudarComprovantes(id: string) {
  const cliente = useQueryClient()
  return (mudar: (lista: Comprovante[]) => Comprovante[]) => {
    cliente.setQueryData<RecebivelDetalhe>(chavesRecebiveis.item(id), (r) => {
      if (!r) return r
      const comprovantes = mudar(r.comprovantes)
      return { ...r, comprovantes, totalComprovantes: comprovantes.length }
    })
    return cliente.invalidateQueries({ queryKey: ['recebiveis', 'lista'] })
  }
}

export function useEnviarComprovanteRecebivel(id: string) {
  const mudar = useMudarComprovantes(id)
  return useMutation({
    mutationFn: (arquivo: File) => {
      const formulario = new FormData()
      formulario.append('arquivo', arquivo)
      return api<Comprovante>(`/recebiveis/${id}/comprovantes`, { method: 'POST', corpo: formulario })
    },
    meta: { semAviso: true },
    onSuccess: (comprovante) => mudar((lista) => [...lista, comprovante]),
  })
}

export function useExcluirComprovanteRecebivel(id: string) {
  const mudar = useMudarComprovantes(id)
  return useMutation({
    mutationFn: (comprovanteId: string) =>
      api<void>(`/recebiveis/${id}/comprovantes/${comprovanteId}`, { method: 'DELETE' }),
    onSuccess: (_r, comprovanteId) => mudar((lista) => lista.filter((c) => c.id !== comprovanteId)),
  })
}

export const useBaixarComprovanteRecebivel = (id: string) =>
  useMutation({
    mutationFn: async (comprovante: Comprovante) =>
      salvarNoAparelho(
        await baixarArquivo(`/recebiveis/${id}/comprovantes/${comprovante.id}`),
        comprovante.nomeOriginal,
      ),
  })
