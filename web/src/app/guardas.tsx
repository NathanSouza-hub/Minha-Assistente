import { Navigate, Outlet, useLocation } from 'react-router'
import { useSessao } from './sessao'

export type EstadoRedirecionamento = { de?: string }

/** Tela de espera enquanto a sessão ou uma tela carregada sob demanda chega. */
export function Carregando() {
  return (
    <div role="status" className="grid min-h-dvh place-items-center text-lg text-muted-foreground">
      Carregando…
    </div>
  )
}

/** Telas internas: sem sessão, manda para o login e volta para cá depois de entrar. */
export function RotaProtegida() {
  const { token, carregando } = useSessao()
  const local = useLocation()

  if (!token) {
    const de = local.pathname + local.search
    return <Navigate to="/entrar" replace state={{ de } satisfies EstadoRedirecionamento} />
  }
  if (carregando) return <Carregando />
  return <Outlet />
}

/**
 * Login e cadastro: quem está logado vai para o app. É também o que leva a pessoa adiante logo
 * depois de entrar — de volta à tela que ela tentou abrir, ou para "Hoje".
 */
export function RotaVisitante() {
  const { token } = useSessao()
  const estado = useLocation().state as EstadoRedirecionamento | null
  return token ? <Navigate to={estado?.de ?? '/'} replace /> : <Outlet />
}
