import { useSearchParams } from 'react-router'
import { mesDe } from '@/lib/datas'
import type { StatusPagamento } from '@/lib/tipos'

export type FiltroStatus = 'todos' | StatusPagamento

/** Mês, aba e filtros moram na URL: recarregar ou voltar mantém o que a pessoa escolheu. */
export function useFiltros() {
  const [params, setParams] = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesDe()
  const status = (params.get('status') as FiltroStatus | null) ?? 'todos'
  const aba = params.get('aba') ?? ''
  const categoriaId = params.get('categoria') ?? ''
  const imovelId = params.get('imovel') ?? ''

  const mudar = (mudancas: Record<string, string>) =>
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual)
        for (const [chave, valor] of Object.entries(mudancas)) {
          if (valor && valor !== 'todos') novo.set(chave, valor)
          else novo.delete(chave)
        }
        return novo
      },
      { replace: true },
    )

  return { mes, status, aba, categoriaId, imovelId, mudar }
}

/** `?voltar=despesas`: a conta aberta pela Lista de despesas volta para ela ao salvar ou excluir. */
export const VOLTAR_DESPESAS = 'despesas'
export const enderecoDespesas = (mes: string) => `/despesas?mes=${mes}`
