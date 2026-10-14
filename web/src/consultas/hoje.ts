// Painel Hoje: junta compromissos, remédios, rotina e contas do dia numa busca só.
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PainelHoje } from '@/lib/tipos'

export const chavesHoje = {
  todos: ['hoje'] as const,
  dia: (data: string) => ['hoje', data] as const,
}

export const usePainelHoje = (data: string) =>
  useQuery({
    queryKey: chavesHoje.dia(data),
    queryFn: () => api<PainelHoje>('/hoje', { query: { data } }),
  })

/** Muda o painel em cache na hora (marcações otimistas feitas a partir de outras telas ou dele). */
export function ajustarPainel(cliente: QueryClient, data: string, mudar: (p: PainelHoje) => PainelHoje) {
  cliente.setQueryData<PainelHoje>(chavesHoje.dia(data), (painel) => painel && mudar(painel))
}

/** Recarrega o painel: qualquer mudança em compromissos, remédios, rotina ou contas afeta o resumo. */
export const invalidarPainel = (cliente: QueryClient) =>
  cliente.invalidateQueries({ queryKey: chavesHoje.todos })
