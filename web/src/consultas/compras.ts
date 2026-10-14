// Consultas e mutações da lista de compras.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ordenarCompras } from '@/lib/compras'
import { agora, paraDataHoraISO } from '@/lib/datas'
import type { ItemCompra, ItemCompraCorpo } from '@/lib/tipos'

export const chavesCompras = {
  lista: ['compras', 'lista'] as const,
}

export const useCompras = () =>
  useQuery({
    queryKey: chavesCompras.lista,
    queryFn: () => api<ItemCompra[]>('/compras'),
    // A tela reordena na hora ao marcar; a ordem final é a mesma do servidor.
    select: ordenarCompras,
  })

/** Troca (ou acrescenta) o item na lista em cache, sem esperar a nova busca. */
function guardar(cliente: QueryClient, item: ItemCompra) {
  cliente.setQueryData<ItemCompra[]>(
    chavesCompras.lista,
    (lista) => lista && [...lista.filter((i) => i.id !== item.id), item],
  )
}

const invalidar = (cliente: QueryClient) => cliente.invalidateQueries({ queryKey: chavesCompras.lista })

export function useSalvarItem() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: ItemCompraCorpo }) =>
      id
        ? api<ItemCompra>(`/compras/${id}`, { method: 'PUT', corpo: dados })
        : api<ItemCompra>('/compras', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: (salvo) => {
      guardar(cliente, salvo)
      return invalidar(cliente)
    },
  })
}

/** Marca ou desmarca. Otimista: o item muda de lugar na hora e volta se o servidor recusar. */
export function useMarcarComprado() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comprado }: { id: string; comprado: boolean }) =>
      api<ItemCompra>(`/compras/${id}/comprado`, { method: 'PATCH', corpo: { comprado } }),
    onMutate: async ({ id, comprado }) => {
      await cliente.cancelQueries({ queryKey: chavesCompras.lista })
      const anterior = cliente.getQueryData<ItemCompra[]>(chavesCompras.lista)
      cliente.setQueryData<ItemCompra[]>(chavesCompras.lista, (lista) =>
        lista?.map((i) =>
          i.id === id ? { ...i, comprado, compradoEm: comprado ? paraDataHoraISO(agora()) : null } : i,
        ),
      )
      return { anterior }
    },
    onError: (_erro, _vars, contexto) => cliente.setQueryData(chavesCompras.lista, contexto?.anterior),
    onSuccess: (item) => guardar(cliente, item),
  })
}

export function useExcluirItem() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/compras/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      cliente.setQueryData<ItemCompra[]>(chavesCompras.lista, (lista) => lista?.filter((i) => i.id !== id))
      return invalidar(cliente)
    },
  })
}

/** Tira da lista todos os já comprados (o back-end não tem exclusão em lote: um DELETE por item). */
export function useLimparComprados() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const resultados = await Promise.allSettled(ids.map((id) => api<void>(`/compras/${id}`, { method: 'DELETE' })))
      const falha = resultados.find((r) => r.status === 'rejected')
      if (falha) throw falha.reason
    },
    // Mesmo com falha em algum, os que saíram precisam sumir da tela.
    onSettled: () => invalidar(cliente),
  })
}
