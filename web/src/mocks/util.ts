import { HttpResponse } from 'msw'
import { banco, type UsuarioMock } from './banco'

export const erro = (status: number, codigo: string, mensagem: string) =>
  HttpResponse.json({ erro: { codigo, mensagem } }, { status })

export const naoEncontrado = (recurso: string) => erro(404, 'NAO_ENCONTRADO', `${recurso} não encontrado.`)

const lerPayload = (token: string) =>
  JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { sub: string; exp: number }

/** Usuário do Bearer token, ou null se ausente/vencido/desconhecido. */
export function usuarioDoToken(request: Request): UsuarioMock | null {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  try {
    const { sub, exp } = lerPayload(token)
    if (exp * 1000 <= Date.now()) return null
    return [...banco.usuarios.values()].find((u) => u.id === sub) ?? null
  } catch {
    return null
  }
}

export const naoAutorizado = () => erro(401, 'NAO_AUTORIZADO', 'Sessão expirada. Entre novamente.')

type Contexto = { request: Request; params: Record<string, string | readonly string[] | undefined> }

/** Envolve um resolver exigindo sessão, como o middleware `autenticar` do back-end. */
export const autenticado =
  <C extends Contexto>(resolver: (ctx: C, usuario: UsuarioMock) => Response | Promise<Response>) =>
  (ctx: C) => {
    const usuario = usuarioDoToken(ctx.request)
    return usuario ? resolver(ctx, usuario) : naoAutorizado()
  }
