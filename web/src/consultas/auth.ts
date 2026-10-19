import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Se dá para criar conta pelo app (CADASTRO_ABERTO no back-end); fechado, só o administrador cria. */
export const useSituacaoCadastro = () =>
  useQuery({
    queryKey: ['cadastro'],
    queryFn: () => api<{ aberto: boolean }>('/auth/cadastro'),
    staleTime: Infinity,
  })
