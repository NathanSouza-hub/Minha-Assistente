import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { handlers } from '@/mocks/handlers'
import { API_URL, ApiError, api, definirAoPerderSessao } from './api'
import { apagarToken, salvarToken } from './sessao'
import type { Sessao } from './tipos'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  servidor.resetHandlers()
  apagarToken()
})
afterAll(() => servidor.close())

describe('api', () => {
  test('envia JSON e devolve o corpo da resposta', async () => {
    const sessao = await api<Sessao>('/auth/login', {
      method: 'POST',
      corpo: { email: 'maria@exemplo.com', senha: 'uma-senha-forte' },
    })
    expect(sessao.usuario.nome).toBe('Maria Silva')
  })

  test('manda o token salvo no cabeçalho Authorization', async () => {
    const { token } = await api<Sessao>('/auth/login', {
      method: 'POST',
      corpo: { email: 'maria@exemplo.com', senha: 'uma-senha-forte' },
    })
    salvarToken(token)
    await expect(api('/auth/me')).resolves.toMatchObject({ email: 'maria@exemplo.com' })
  })

  test('converte o erro do contrato em ApiError', async () => {
    const promessa = api('/auth/login', { method: 'POST', corpo: { email: 'x@x.com', senha: 'errada' } })
    await expect(promessa).rejects.toBeInstanceOf(ApiError)
    await expect(promessa).rejects.toMatchObject({
      status: 401,
      codigo: 'CREDENCIAIS_INVALIDAS',
      message: 'E-mail ou senha incorretos.',
    })
  })

  test('NAO_AUTORIZADO avisa que a sessão acabou', async () => {
    const aoPerder = vi.fn()
    definirAoPerderSessao(aoPerder)
    await expect(api('/auth/me')).rejects.toMatchObject({ codigo: 'NAO_AUTORIZADO' })
    expect(aoPerder).toHaveBeenCalledOnce()
  })

  test('ignora filtros vazios na query string', async () => {
    let url = ''
    servidor.use(
      http.get(`${API_URL}/pagamentos`, ({ request }) => {
        url = request.url
        return HttpResponse.json([])
      }),
    )
    await api('/pagamentos', { query: { status: 'pendente', categoriaId: '', imovelId: undefined } })
    expect(new URL(url).search).toBe('?status=pendente')
  })

  test('falha de rede vira SEM_CONEXAO', async () => {
    servidor.use(http.get(`${API_URL}/saude`, () => HttpResponse.error()))
    await expect(api('/saude')).rejects.toMatchObject({ codigo: 'SEM_CONEXAO' })
  })
})
