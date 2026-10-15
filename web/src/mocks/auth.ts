import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import type { Usuario } from '@/lib/tipos'
import { banco, criarCategoriasPadrao, type UsuarioMock } from './banco'
import { autenticado, erro } from './util'

// JWT falso com `exp` em 30 dias; a assinatura não importa no mock.
function tokenFalso(usuarioId: string) {
  const base64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: usuarioId, exp })}.mock`
}

const publico = ({ senha: _senha, ...usuario }: UsuarioMock): Usuario => usuario

export const handlersAuth = [
  http.get(`${API_URL}/saude`, () => HttpResponse.json({ status: 'ok', banco: 'ok' })),

  http.post(`${API_URL}/auth/cadastro`, async ({ request }) => {
    const { nome, email, senha } = (await request.json()) as Record<string, string>
    const chave = email?.trim().toLowerCase()
    if (!nome?.trim() || !chave || !senha || senha.length < 8) {
      return erro(400, 'VALIDACAO', 'senha: A senha precisa ter pelo menos 8 caracteres.')
    }
    if (banco.usuarios.has(chave)) return erro(409, 'EMAIL_EM_USO', 'Já existe uma conta com este e-mail.')
    const usuario: UsuarioMock = {
      id: crypto.randomUUID(),
      nome: nome.trim(),
      email: chave,
      senha,
      criadoEm: '2026-10-13T09:00:00-03:00',
    }
    banco.usuarios.set(chave, usuario)
    criarCategoriasPadrao(usuario.id)
    return HttpResponse.json({ token: tokenFalso(usuario.id), usuario: publico(usuario) }, { status: 201 })
  }),

  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const { email, senha } = (await request.json()) as Record<string, string>
    const usuario = banco.usuarios.get(email?.trim().toLowerCase())
    if (!usuario || usuario.senha !== senha) {
      return erro(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.')
    }
    return HttpResponse.json({ token: tokenFalso(usuario.id), usuario: publico(usuario) })
  }),

  http.get(
    `${API_URL}/auth/me`,
    autenticado((_ctx, usuario) => HttpResponse.json(publico(usuario))),
  ),
]
