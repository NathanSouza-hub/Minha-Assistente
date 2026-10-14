// Sessão da pessoa logada: token no aparelho + dados de /auth/me.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, definirAoPerderSessao } from '@/lib/api'
import { desativar as desativarNotificacoes } from '@/lib/notificacoes'
import { apagarToken, lerToken, salvarToken, tokenExpirado } from '@/lib/sessao'
import type { Sessao, Usuario } from '@/lib/tipos'

type ValorSessao = {
  token: string | null
  usuario: Usuario | undefined
  /** true enquanto há token mas /auth/me ainda não respondeu. */
  carregando: boolean
  entrar: (sessao: Sessao) => void
  sair: () => void
}

const ContextoSessao = createContext<ValorSessao | null>(null)

const tokenInicial = () => {
  const token = lerToken()
  if (tokenExpirado(token)) {
    apagarToken()
    return null
  }
  return token
}

const chaveUsuario = ['auth', 'me'] as const

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const clienteConsultas = useQueryClient()
  const [token, setToken] = useState(tokenInicial)

  const { data: usuario, isPending } = useQuery({
    queryKey: chaveUsuario,
    queryFn: () => api<Usuario>('/auth/me'),
    enabled: token !== null,
    staleTime: Infinity,
  })

  const entrar = useCallback(
    ({ token: novoToken, usuario: novoUsuario }: Sessao) => {
      // Aparelho pode ser compartilhado: nada da conta anterior pode sobrar no cache.
      clienteConsultas.clear()
      salvarToken(novoToken)
      clienteConsultas.setQueryData(chaveUsuario, novoUsuario)
      setToken(novoToken)
    },
    [clienteConsultas],
  )

  const sair = useCallback(() => {
    // Aparelho compartilhado: quem saiu não pode continuar recebendo os lembretes aqui. Vai com o
    // token na mão porque ele é apagado logo abaixo; se falhar, o servidor apaga a inscrição
    // quando o push voltar como expirado.
    void desativarNotificacoes({ token: lerToken() }).catch(() => {})
    apagarToken()
    setToken(null)
    clienteConsultas.clear()
  }, [clienteConsultas])

  useEffect(() => {
    definirAoPerderSessao(() => {
      if (!lerToken()) return
      sair()
      toast.info('Sua sessão expirou. Entre novamente.', { id: 'sessao-expirada' })
    })
    return () => definirAoPerderSessao(() => {})
  }, [sair])

  const valor = useMemo(
    () => ({ token, usuario, carregando: token !== null && isPending, entrar, sair }),
    [token, usuario, isPending, entrar, sair],
  )

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}

export function useSessao() {
  const valor = useContext(ContextoSessao)
  if (!valor) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>.')
  return valor
}
