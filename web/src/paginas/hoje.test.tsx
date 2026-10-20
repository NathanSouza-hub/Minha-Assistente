import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'
import { api, API_URL } from '@/lib/api'
import { salvarToken } from '@/lib/sessao'
import type { Sessao } from '@/lib/tipos'

const servidor = setupServer(...handlers)

const relogio = (iso: string) => vi.setSystemTime(new Date(iso))

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026, 08h. Dados de exemplo da Maria: 4 doses (1 tomada), fisioterapia 9h e
  // consulta 15h, 4 compromissos com hora e 1 sem (1 feito), condomínio vencido no dia 10.
  vi.useFakeTimers({ toFake: ['Date'] })
  relogio('2026-10-13T08:00:00-03:00')
  resetarBancoMock()
})
afterEach(() => {
  servidor.resetHandlers()
  localStorage.clear()
  vi.useRealTimers()
})
afterAll(() => servidor.close())

// As atrasadas ficam numa seção em cima; as linhas vêm na ordem da tela (atrasadas primeiro).
const linhas = async () => {
  const doDia = await screen.findByRole('region', { name: /^Atividades d/ })
  const atras = screen.queryByRole('region', { name: 'Atrasadas' })
  return [...(atras ? within(atras).getAllByRole('listitem') : []), ...within(doDia).queryAllByRole('listitem')]
}
const linhaDe = async (texto: string) => (await linhas()).find((l) => within(l).queryByText(texto))!
const atrasadas = () => screen.queryByRole('region', { name: 'Atrasadas' })

describe('tela Hoje: tarefas do dia', () => {
  beforeEach(entrarComoMaria)

  test('Início: atrasadas em cima, o resto em ordem de horário, o "dia todo" no fim', async () => {
    renderizarApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Terça-feira, 13 de outubro' })).toBeInTheDocument()
    expect(screen.getByText('Bom dia, Maria')).toBeInTheDocument()
    expect(await screen.findByText('Para hoje: 11 tarefas, 2 concluídas e 1 atrasada.')).toBeInTheDocument()
    // Sem indicadores nem finanças no Início.
    expect(screen.queryByText('Despesas do mês')).not.toBeInTheDocument()

    const titulos = (await linhas()).map((l) => within(l).getByRole('link').querySelector('p')!.textContent)
    expect(titulos[0]).toBe('Condomínio')
    expect(within(atrasadas()!).getAllByRole('listitem')).toHaveLength(1)
    expect(titulos.slice(1, 5)).toEqual(['Omeprazol', 'Losartana', 'Ler e-mails', 'Vitamina D'])
    expect(titulos.at(-1)).toBe('Regar as plantas')

    // Dose sempre com a unidade; conta com valor, imóvel e o dia em que venceu.
    expect(within(await linhaDe('Vitamina D')).getByText('1 gota de 50.000 UI')).toBeInTheDocument()
    const condominio = await linhaDe('Condomínio')
    expect(within(condominio).getByText('R$ 1.250,00 · Apartamento cobertura · Venceu em 10/10')).toBeInTheDocument()
    expect(within(condominio).getByText('(atrasado)')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dia todo' })).toBeInTheDocument()

    // Feito: ✓ preenchido e título riscado.
    const omeprazol = await linhaDe('Omeprazol')
    expect(within(omeprazol).getByRole('button', { name: 'Tomei: Omeprazol' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(omeprazol).getByText('Omeprazol')).toHaveClass('line-through')
  })

  test('horário que já passou fica em vermelho como atrasado', async () => {
    relogio('2026-10-13T10:00:00-03:00')
    renderizarApp('/hoje')
    const fisio = await linhaDe('Fisioterapia')
    expect(within(fisio).getByText('09:00')).toHaveClass('text-atraso')
    expect(within(fisio).getByRole('button', { name: 'Fiz: Fisioterapia' })).toBeInTheDocument()
    expect(within(atrasadas()!).getAllByRole('listitem')).toHaveLength(5)
  })

  test('✓ no remédio vale na tela de Remédios; tocar de novo desfaz', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/hoje')
    const tomei = within(await linhaDe('Vitamina D')).getByRole('button', { name: 'Tomei: Vitamina D' })
    await usuario.click(tomei)
    expect(tomei).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText(/3 concluídas/)).toBeInTheDocument()

    await usuario.click(tomei)
    await waitFor(() => expect(tomei).toHaveAttribute('aria-pressed', 'false'))
    expect(await screen.findByText(/2 concluídas/)).toBeInTheDocument()

    await usuario.click(tomei)
    expect(await screen.findByText(/3 concluídas/)).toBeInTheDocument()
    await usuario.click(screen.getAllByRole('link', { name: /Saúde/ })[0])
    expect(await screen.findByText('2 de 4 doses tomadas')).toBeInTheDocument()
  })

  test('✓ na conta marca como paga (como "Marcar como pago"); ✗ marca como não paga', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/hoje')
    const condominio = await linhaDe('Condomínio')
    await usuario.click(within(condominio).getByRole('button', { name: 'Paguei: Condomínio' }))
    await waitFor(() => expect(atrasadas()).not.toBeInTheDocument())
    const contas = await api<{ descricao: string; status: string }[]>('/pagamentos', { query: { fim: '2026-10-10' } })
    expect(contas.find((p) => p.descricao === 'Condomínio')?.status).toBe('pago')

    // Paga hoje, continua na lista (e pode ser desfeita).
    const naoPaguei = within(await linhaDe('Condomínio')).getByRole('button', { name: 'Não paguei: Condomínio' })
    await usuario.click(naoPaguei)
    await waitFor(() => expect(naoPaguei).toHaveAttribute('aria-pressed', 'true'))
    const depois = await api<{ descricao: string; status: string }[]>('/pagamentos', { query: { fim: '2026-10-10' } })
    expect(depois.find((p) => p.descricao === 'Condomínio')?.status).toBe('pendente')
  })

  test('se a API recusar, a marcação volta atrás', async () => {
    servidor.use(
      http.patch(`${API_URL}/hoje/:id`, () =>
        HttpResponse.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falhou.' } }, { status: 500 }),
      ),
    )
    const usuario = userEvent.setup()
    renderizarApp('/hoje')
    const naoFiz = within(await linhaDe('Regar as plantas')).getByRole('button', { name: 'Não fiz: Regar as plantas' })
    await usuario.click(naoFiz)
    expect(await screen.findByText('Falhou.')).toBeInTheDocument()
    await waitFor(() => expect(naoFiz).toHaveAttribute('aria-pressed', 'false'))
  })

  test('seletor de data: outro dia, sem as contas vencidas antes, e volta para hoje', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/hoje')
    await linhaDe('Condomínio')
    await usuario.click(screen.getByRole('button', { name: 'Próximo dia' }))
    expect(await screen.findByText(/^Amanhã, 14 de outubro/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Condomínio')).not.toBeInTheDocument())
    expect(await screen.findByText(/^Neste dia:/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Voltar para hoje' }))
    expect(await linhaDe('Condomínio')).toBeInTheDocument()
  })
})

test('conta nova, sem nada: "Nada programado para hoje."', async () => {
  const { token } = await api<Sessao>('/auth/cadastro', {
    method: 'POST',
    corpo: { nome: 'Pessoa Nova', email: 'nova@exemplo.com', senha: 'senha-da-pessoa' },
  })
  salvarToken(token)
  renderizarApp('/hoje')
  expect(await screen.findByText('Nada programado para hoje.')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Nova' }).length).toBeGreaterThan(0)
})
