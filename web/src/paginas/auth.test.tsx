import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { handlers } from '@/mocks/handlers'
import { API_URL } from '@/lib/api'
import { lerToken, salvarToken } from '@/lib/sessao'
import { renderizarApp } from '@/test/renderizarApp'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  servidor.resetHandlers()
  localStorage.clear()
})
afterAll(() => servidor.close())

const jwtCom = (payload: object) => `h.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.s`
const emSegundos = (deslocamento: number) => Math.floor(Date.now() / 1000) + deslocamento

async function preencherLogin(email: string, senha: string) {
  const usuario = userEvent.setup()
  await usuario.type(await screen.findByLabelText('E-mail'), email)
  await usuario.type(screen.getByLabelText('Senha'), senha)
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
  return usuario
}

describe('rotas protegidas', () => {
  test('sem sessão, manda para o login e volta para a tela pedida depois de entrar', async () => {
    const { roteador } = renderizarApp('/pagamentos')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()

    await preencherLogin('maria@exemplo.com', 'uma-senha-forte')

    expect(await screen.findByRole('heading', { name: 'Cadastro de despesas' })).toBeInTheDocument()
    expect(roteador.state.location.pathname).toBe('/pagamentos')
    expect(lerToken()).toBeTruthy()
  })

  test('token vencido salvo no aparelho é descartado', async () => {
    salvarToken(jwtCom({ sub: 'x', exp: emSegundos(-60) }))
    renderizarApp('/')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(lerToken()).toBeNull()
  })

  test('se a API recusar o token, a sessão acaba e volta para o login', async () => {
    salvarToken(jwtCom({ sub: 'conta-apagada', exp: emSegundos(3600) }))
    renderizarApp('/')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(lerToken()).toBeNull()
  })

  test('quem já está logado não vê a tela de login', async () => {
    renderizarApp('/entrar')
    await preencherLogin('maria@exemplo.com', 'uma-senha-forte')
    expect(await screen.findByText('Maria Silva')).toBeInTheDocument()
  })

  test('sair da conta apaga o token e volta para o login', async () => {
    renderizarApp('/mais')
    const usuario = await preencherLogin('maria@exemplo.com', 'uma-senha-forte')
    // Aparece no "Mais" e na barra lateral (o jsdom não aplica o CSS que esconde uma delas).
    const [botaoSair] = await screen.findAllByRole('button', { name: 'Sair da conta' })
    await usuario.click(botaoSair)
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(lerToken()).toBeNull()
  })
})

describe('login', () => {
  test('senha errada mostra a mensagem da API no formulário', async () => {
    renderizarApp('/entrar')
    await preencherLogin('maria@exemplo.com', 'senha-errada')
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
    expect(lerToken()).toBeNull()
  })

  test('campos vazios são barrados antes de chamar a API', async () => {
    renderizarApp('/entrar')
    const usuario = userEvent.setup()
    await usuario.click(await screen.findByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument()
  })
})

describe('cadastro', () => {
  async function preencherCadastro(nome: string, email: string, senha: string) {
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByLabelText('Seu nome'), nome)
    await usuario.type(screen.getByLabelText('E-mail'), email)
    await usuario.type(screen.getByLabelText('Crie uma senha'), senha)
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
  }

  test('cria a conta e entra direto no app', async () => {
    const { roteador } = renderizarApp('/cadastro')
    await preencherCadastro('João Souza', 'joao@exemplo.com', 'senha-do-joao')
    expect(await screen.findByText('João Souza')).toBeInTheDocument()
    expect(roteador.state.location.pathname).toBe('/')
  })

  test('e-mail já cadastrado aparece no campo de e-mail', async () => {
    renderizarApp('/cadastro')
    await preencherCadastro('Outra Maria', 'MARIA@exemplo.com', 'outra-senha-forte')
    const campo = screen.getByLabelText('E-mail')
    await waitFor(() => expect(campo).toHaveAccessibleDescription('Já existe uma conta com este e-mail.'))
    expect(campo).toHaveAttribute('aria-invalid', 'true')
  })

  test('senha curta é barrada no formulário', async () => {
    renderizarApp('/cadastro')
    await preencherCadastro('Ana', 'ana@exemplo.com', 'curta')
    expect(await screen.findByText('A senha precisa ter pelo menos 8 caracteres.')).toBeInTheDocument()
  })

  test('erro VALIDACAO do back-end é distribuído pelos campos', async () => {
    servidor.use(
      http.post(`${API_URL}/auth/cadastro`, () =>
        HttpResponse.json(
          { erro: { codigo: 'VALIDACAO', mensagem: 'nome: Nome longo demais.' } },
          { status: 400 },
        ),
      ),
    )
    renderizarApp('/cadastro')
    await preencherCadastro('Ana', 'ana@exemplo.com', 'senha-forte-da-ana')
    expect(await screen.findByText('Nome longo demais.')).toBeInTheDocument()
  })
})
