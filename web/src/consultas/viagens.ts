// Consultas e mutações de viagens e anexos.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, baixarArquivo } from '@/lib/api'
import { salvarNoAparelho } from '@/lib/arquivos'
import type { AnexoViagem, Viagem, ViagemCorpo } from '@/lib/tipos'
import { invalidarPainel } from './hoje'

export const chavesViagens = {
  todos: ['viagens'] as const,
  lista: ['viagens', 'lista'] as const,
  item: (id: string) => ['viagens', 'item', id] as const,
}

export const useViagens = () =>
  useQuery({ queryKey: chavesViagens.lista, queryFn: () => api<Viagem[]>('/viagens') })

export const useViagem = (id: string | undefined) =>
  useQuery({
    queryKey: chavesViagens.item(id ?? ''),
    queryFn: () => api<Viagem>(`/viagens/${id}`),
    enabled: Boolean(id),
  })

// Mesma ordem do back-end: a ida mais recente primeiro.
const ordenar = (lista: Viagem[]) => [...lista].sort((a, b) => b.ida.localeCompare(a.ida))

/** Põe a viagem atualizada na lista e no detalhe em cache, para as telas não mostrarem o dado antigo. */
function guardar(cliente: QueryClient, viagem: Viagem) {
  cliente.setQueryData(chavesViagens.item(viagem.id), viagem)
  cliente.setQueryData<Viagem[]>(
    chavesViagens.lista,
    (lista) => lista && ordenar([...lista.filter((v) => v.id !== viagem.id), viagem]),
  )
}

function mudarAnexos(cliente: QueryClient, viagemId: string, mudar: (anexos: AnexoViagem[]) => AnexoViagem[]) {
  const viagem = cliente.getQueryData<Viagem>(chavesViagens.item(viagemId))
  if (viagem) guardar(cliente, { ...viagem, anexos: mudar(viagem.anexos) })
}

export function useSalvarViagem() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: ViagemCorpo }) =>
      id
        ? api<Viagem>(`/viagens/${id}`, { method: 'PUT', corpo: dados })
        : api<Viagem>('/viagens', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: (salva) => {
      guardar(cliente, salva)
      return Promise.all([cliente.invalidateQueries({ queryKey: chavesViagens.lista }), invalidarPainel(cliente)])
    },
  })
}

export function useExcluirViagem() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/viagens/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      // Sai do cache antes de recarregar, para a tela ainda aberta não buscar de novo (404).
      cliente.removeQueries({ queryKey: chavesViagens.item(id) })
      cliente.setQueryData<Viagem[]>(chavesViagens.lista, (lista) => lista?.filter((v) => v.id !== id))
      return Promise.all([cliente.invalidateQueries({ queryKey: chavesViagens.lista }), invalidarPainel(cliente)])
    },
  })
}

export function useEnviarAnexo(viagemId: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (arquivo: File) => {
      const formulario = new FormData()
      formulario.append('arquivo', arquivo)
      return api<AnexoViagem>(`/viagens/${viagemId}/anexos`, { method: 'POST', corpo: formulario })
    },
    // A tela avisa com o nome do arquivo (podem ser vários de uma vez).
    meta: { semAviso: true },
    onSuccess: (anexo) => mudarAnexos(cliente, viagemId, (anexos) => [...anexos, anexo]),
  })
}

export function useExcluirAnexo(viagemId: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (anexoId: string) => api<void>(`/viagens/${viagemId}/anexos/${anexoId}`, { method: 'DELETE' }),
    onSuccess: (_r, anexoId) => mudarAnexos(cliente, viagemId, (anexos) => anexos.filter((a) => a.id !== anexoId)),
  })
}

/** Baixa o anexo e entrega ao navegador com o nome original. */
export const useBaixarAnexo = (viagemId: string) =>
  useMutation({
    mutationFn: async (anexo: AnexoViagem) =>
      salvarNoAparelho(await baixarArquivo(`/viagens/${viagemId}/anexos/${anexo.id}`), anexo.nomeOriginal),
  })
