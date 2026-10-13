import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'

declare module '@tanstack/react-query' {
  interface Register {
    /** `semAviso: true` = a própria tela mostra o erro (ex.: formulário), sem toast. */
    queryMeta: { semAviso?: boolean }
    mutationMeta: { semAviso?: boolean }
  }
}

const mensagemDe = (erro: unknown) =>
  erro instanceof ApiError ? erro.message : 'Algo deu errado. Tente de novo em instantes.'

// NAO_AUTORIZADO é tratado na sessão (logout); VALIDACAO aparece no formulário.
const deveAvisar = (erro: unknown, meta?: { semAviso?: boolean }) =>
  !meta?.semAviso && !(erro instanceof ApiError && ['NAO_AUTORIZADO', 'VALIDACAO'].includes(erro.codigo))

/** Fábrica usada pelo app e pelos testes (que precisam de um cliente novo a cada teste). */
export function criarClienteConsultas({ repetir = true } = {}) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (erro, consulta) => {
        if (deveAvisar(erro, consulta.meta)) toast.error(mensagemDe(erro))
      },
    }),
    mutationCache: new MutationCache({
      onError: (erro, _variaveis, _contexto, mutacao) => {
        if (deveAvisar(erro, mutacao.meta)) toast.error(mensagemDe(erro))
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Erro 4xx não melhora repetindo; só falha de rede e 5xx tentam de novo.
        retry: (tentativas, erro) =>
          repetir && tentativas < 2 && !(erro instanceof ApiError && erro.status >= 400 && erro.status < 500),
      },
    },
  })
}

export const clienteConsultas = criarClienteConsultas()
