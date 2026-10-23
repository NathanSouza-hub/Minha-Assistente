// O que foi concluído por dia (tarefas de uma vez e compromissos). Só o que muda a contagem a
// invalida: concluir, reabrir ou excluir tarefa e compromisso (consultas/tarefas.ts e rotinas.ts); a
// marcação pelo Início já recarrega tudo.
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { RelatorioProdutividade } from '@/lib/tipos'

export const chavesProdutividade = {
  todas: ['produtividade'] as const,
  periodo: (periodo: { inicio: string; fim: string }) => ['produtividade', periodo] as const,
}

export const useProdutividade = (periodo: { inicio: string; fim: string }) =>
  useQuery({
    queryKey: chavesProdutividade.periodo(periodo),
    queryFn: () => api<RelatorioProdutividade>('/relatorios/produtividade', { query: periodo }),
    placeholderData: (anterior) => anterior,
  })

export const invalidarProdutividade = (cliente: QueryClient) =>
  cliente.invalidateQueries({ queryKey: chavesProdutividade.todas })
