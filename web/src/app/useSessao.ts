// Contexto e hook da sessão, separados de sessao.tsx (que só exporta o componente provedor).
import { createContext, useContext } from 'react'
import type { Sessao, Usuario } from '@/lib/tipos'

export type ValorSessao = {
  token: string | null
  usuario: Usuario | undefined
  /** true enquanto há token mas /auth/me ainda não respondeu. */
  carregando: boolean
  entrar: (sessao: Sessao) => void
  sair: () => void
}

export const ContextoSessao = createContext<ValorSessao | null>(null)

export function useSessao() {
  const valor = useContext(ContextoSessao)
  if (!valor) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>.')
  return valor
}
