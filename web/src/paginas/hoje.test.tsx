import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'
import { api } from '@/lib/api'
import { salvarToken } from '@/lib/sessao'
import type { Sessao } from '@/lib/tipos'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026, 08h. Dados de exemplo da Maria: fisioterapia 9h e consulta 15h; 4 doses
  // (1 tomada); 4 tarefas (1 feita); condomínio vencido; luz e salário vencem nesta semana.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T08:00:00-03:00'))
  resetarBancoMock()
})
afterEach(() => {
  servidor.resetHandlers()
  localStorage.clear()
  vi.useRealTimers()
})
afterAll(() => servidor.close())

const secao = (nome: string | RegExp) => screen.findByRole('region', { name: nome })

describe('painel Hoje', () => {
  beforeEach(entrarComoMaria)

  test('junta o dia: resumo, vencidas em destaque, compromissos, remédios, rotina e contas da semana', async () => {
    renderizarApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Bom dia, Maria' })).toBeInTheDocument()
    expect(screen.getByText('Terça-feira, 13 de outubro')).toBeInTheDocument()
    expect(
      await screen.findByText('Para hoje: 2 agendamentos, 3 remédios para tomar e 3 compromissos.'),
    ).toBeInTheDocument()

    const vencidas = await secao('Conta vencida')
    expect(within(vencidas).getByText('R$ 1.250,00 em atraso')).toBeInTheDocument()
    expect(within(vencidas).getByText('Venceu há 3 dias')).toBeInTheDocument()

    const agenda = await secao('Agendamentos')
    expect(within(agenda).getByText('Fisioterapia')).toBeInTheDocument()
    expect(within(agenda).getByRole('link', { name: /Entrar/ })).toBeInTheDocument()

    expect(within(await secao('Remédios')).getByText('1 de 4 tomados')).toBeInTheDocument()
    expect(within(await secao('Compromissos')).getByText('1 de 4 feitos')).toBeInTheDocument()

    const semana = await secao('Contas dos próximos 7 dias')
    expect(within(semana).getByText('Conta de luz')).toBeInTheDocument()
    expect(within(semana).getByText('Joana')).toBeInTheDocument()
    expect(within(semana).getByText('R$ 2.038,90 no total')).toBeInTheDocument()
  })

  test('tudo marcável sem sair da tela, e o resumo acompanha', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/')
    await usuario.click(await screen.findByRole('button', { name: 'Tomei Vitamina D' }))
    expect(within(await secao('Remédios')).getByText('2 de 4 tomados')).toBeInTheDocument()

    await usuario.click(screen.getByRole('checkbox', { name: /Ler mensagens do WhatsApp/ }))
    expect(within(await secao('Compromissos')).getByText('2 de 4 feitos')).toBeInTheDocument()
    expect(
      await screen.findByText('Para hoje: 2 agendamentos, 2 remédios para tomar e 2 compromissos.'),
    ).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Marcar Condomínio como pago' }))
    expect(await screen.findByText('Condomínio marcado como pago.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Conta vencida' })).not.toBeInTheDocument())
  })

  test('marcar no painel vale também na tela de Remédios', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/')
    await usuario.click(await screen.findByRole('button', { name: 'Tomei Vitamina D' }))
    await screen.findByText('2 de 4 tomados')
    await usuario.click(screen.getByRole('link', { name: 'Ver remédios' }))
    expect(await screen.findByText('2 de 4 doses tomadas')).toBeInTheDocument()
  })
})

test('conta nova, sem nada: "Dia livre"', async () => {
  const { token } = await api<Sessao>('/auth/cadastro', {
    method: 'POST',
    corpo: { nome: 'Pessoa Nova', email: 'nova@exemplo.com', senha: 'senha-da-pessoa' },
  })
  salvarToken(token)
  renderizarApp('/')
  expect(await screen.findByText('Dia livre')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Novo agendamento' })).toBeInTheDocument()
})
