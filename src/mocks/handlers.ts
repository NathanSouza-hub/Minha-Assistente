// API falsa para desenvolver as telas antes do back-end. Os dados vivem só na memória da aba.
// Siga o contrato do back-end à risca: trocar pelo servidor real não pode exigir mudar telas.
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import type { Usuario } from '@/lib/tipos'

type UsuarioMock = Usuario & { senha: string }

const usuarios = new Map<string, UsuarioMock>([
  [
    'maria@exemplo.com',
    {
      id: '6f1c7a52-2d1e-4b8a-9f3e-1a2b3c4d5e6f',
      nome: 'Maria Silva',
      email: 'maria@exemplo.com',
      senha: 'uma-senha-forte',
      criadoEm: '2026-10-01T09:00:00-03:00',
    },
  ],
])

const erro = (status: number, codigo: string, mensagem: string) =>
  HttpResponse.json({ erro: { codigo, mensagem } }, { status })

// JWT falso com `exp` em 30 dias; a assinatura não importa no mock.
function tokenFalso(usuarioId: string) {
  const base64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: usuarioId, exp })}.mock`
}

const publico = ({ senha: _senha, ...usuario }: UsuarioMock): Usuario => usuario

function usuarioDoToken(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  try {
    const { sub, exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (exp * 1000 <= Date.now()) return null
    return [...usuarios.values()].find((u) => u.id === sub) ?? null
  } catch {
    return null
  }
}

export const handlers = [
  http.get(`${API_URL}/saude`, () => HttpResponse.json({ status: 'ok', banco: 'ok' })),

  http.post(`${API_URL}/auth/cadastro`, async ({ request }) => {
    const { nome, email, senha } = (await request.json()) as Record<string, string>
    const chave = email?.trim().toLowerCase()
    if (!nome?.trim() || !chave || !senha || senha.length < 8) {
      return erro(400, 'VALIDACAO', 'senha: A senha precisa ter pelo menos 8 caracteres.')
    }
    if (usuarios.has(chave)) return erro(409, 'EMAIL_EM_USO', 'Já existe uma conta com este e-mail.')
    const usuario: UsuarioMock = {
      id: crypto.randomUUID(),
      nome: nome.trim(),
      email: chave,
      senha,
      criadoEm: new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00'),
    }
    usuarios.set(chave, usuario)
    return HttpResponse.json({ token: tokenFalso(usuario.id), usuario: publico(usuario) }, { status: 201 })
  }),

  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const { email, senha } = (await request.json()) as Record<string, string>
    const usuario = usuarios.get(email?.trim().toLowerCase())
    if (!usuario || usuario.senha !== senha) {
      return erro(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.')
    }
    return HttpResponse.json({ token: tokenFalso(usuario.id), usuario: publico(usuario) })
  }),

  http.get(`${API_URL}/auth/me`, ({ request }) => {
    const usuario = usuarioDoToken(request)
    if (!usuario) return erro(401, 'NAO_AUTORIZADO', 'Sessão expirada. Entre novamente.')
    return HttpResponse.json(publico(usuario))
  }),
]
