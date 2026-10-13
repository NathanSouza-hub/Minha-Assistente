import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'

const mensagemDe = (erro: unknown) =>
  erro instanceof ApiError ? erro.message : 'Algo deu errado. Tente de novo em instantes.'

// NAO_AUTORIZADO é tratado no cliente da API (logout); VALIDACAO aparece no formulário.
const deveAvisar = (erro: unknown) =>
  !(erro instanceof ApiError && ['NAO_AUTORIZADO', 'VALIDACAO'].includes(erro.codigo))

const avisar = (erro: unknown) => {
  if (deveAvisar(erro)) toast.error(mensagemDe(erro))
}

export const clienteConsultas = new QueryClient({
  queryCache: new QueryCache({ onError: avisar }),
  mutationCache: new MutationCache({ onError: avisar }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Erro 4xx não melhora repetindo; só falha de rede e 5xx tentam de novo.
      retry: (tentativas, erro) =>
        tentativas < 2 && !(erro instanceof ApiError && erro.status >= 400 && erro.status < 500),
    },
  },
})
