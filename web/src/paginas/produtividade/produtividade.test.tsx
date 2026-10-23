import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { API_URL } from '@/lib/api'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'

const servidor = setupServer(...handlers)
const pedidos: URL[] = []

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026: o mock tem "Ler e-mails" feito hoje às 08:40 (um compromisso).
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T10:00:00-03:00'))
  resetarBancoMock()
  await entrarComoMaria()
  pedidos.length = 0
  servidor.events.on('request:start', ({ request }) => {
    if (request.url.includes('/relatorios/produtividade')) pedidos.push(new URL(request.url))
  })
})
afterEach(() => {
  servidor.resetHandlers()
  servidor.events.removeAllListeners()
  localStorage.clear()
  vi.useRealTimers()
})
afterAll(() => servidor.close())

const total = () => screen.findByRole('region', { name: 'Total do período' })

describe('O que foi feito', () => {
  test('últimos 30 dias por padrão: total, divisão e a tabela com todos os dias, zeros incluídos', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/produtividade')
    expect(await total()).toHaveTextContent('Concluídos nos últimos 30 dias1')
    expect(await total()).toHaveTextContent('0 tarefas · 1 compromisso')
    expect(pedidos.at(-1)?.searchParams.get('inicio')).toBe('2026-09-14')
    expect(pedidos.at(-1)?.searchParams.get('fim')).toBe('2026-10-13')

    const grafico = screen.getByRole('region', { name: 'Concluídos por dia' })
    await usuario.click(within(grafico).getByText('Ver os números'))
    const linhas = within(grafico).getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(30)
    expect(linhas.at(-1)).toHaveTextContent('Terça, 13 de outubro011')
    expect(linhas[0]).toHaveTextContent('Segunda, 14 de setembro000')
    // Está no menu de Lembretes.
    expect(screen.getAllByRole('link', { name: 'O que foi feito', current: 'page' }).length).toBeGreaterThan(0)
  })

  test('concluir uma tarefa aparece no total sem recarregar a página', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/tarefas')
    await usuario.click(await screen.findByRole('button', { name: 'Marcar Conferir pagamentos no banco como feita' }))
    await screen.findByText('Pronto, tarefa feita.')
    await usuario.click(screen.getAllByRole('link', { name: 'O que foi feito' })[0])
    expect(await total()).toHaveTextContent('1 tarefa · 1 compromisso')
  })

  test('12 semanas: começa numa segunda e agrupa por semana', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/produtividade')
    await total()
    await usuario.click(screen.getByRole('radio', { name: '12 semanas' }))
    const grafico = await screen.findByRole('region', { name: 'Concluídos por semana' })
    expect(pedidos.at(-1)?.searchParams.get('inicio')).toBe('2026-07-27')
    await usuario.click(within(grafico).getByText('Ver os números'))
    const linhas = within(grafico).getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(12)
    expect(linhas.at(-1)).toHaveTextContent('12/10 a 13/10011')
    expect(await total()).toHaveTextContent('Concluídos nas últimas 12 semanas1')
  })

  test('durante a troca de período, os dados anteriores ficam com os rótulos deles', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/produtividade')
    await total()
    servidor.use(
      http.get(`${API_URL}/relatorios/produtividade`, async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )
    await usuario.click(screen.getByRole('radio', { name: '12 semanas' }))
    // Ainda os 30 dias (por dia), não "12 semanas" com os números de 30 dias.
    expect(await total()).toHaveTextContent('Concluídos nos últimos 30 dias1')
    expect(screen.getByRole('region', { name: 'Concluídos por dia' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Concluídos por semana' })).not.toBeInTheDocument()
  })

  test('tocar numa coluna e trocar de período não quebra a tela', async () => {
    const usuario = userEvent.setup()
    const largura = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
    try {
      const { container } = renderizarApp('/produtividade')
      await total()
      const alvos = container.querySelectorAll('svg rect[fill="transparent"]')
      expect(alvos).toHaveLength(30)
      await usuario.click(alvos[29])
      expect(await screen.findByText('Terça, 13 de outubro', { selector: 'p' })).toBeInTheDocument()
      await usuario.click(screen.getByRole('radio', { name: '7 dias' }))
      expect(await total()).toHaveTextContent('Concluídos nos últimos 7 dias1')
      expect(container.querySelectorAll('svg rect[fill="transparent"]')).toHaveLength(7)
    } finally {
      largura.mockRestore()
    }
  })

  test('período sem nada concluído diz isso, sem gráfico vazio', async () => {
    servidor.use(
      http.get(`${API_URL}/relatorios/produtividade`, ({ request }) => {
        const q = new URL(request.url).searchParams
        const zero = { tarefas: 0, compromissos: 0, total: 0 }
        return HttpResponse.json({
          inicio: q.get('inicio'),
          fim: q.get('fim'),
          total: zero,
          dias: [{ data: q.get('fim'), ...zero }],
          semanas: [{ inicio: q.get('fim'), fim: q.get('fim'), ...zero }],
        })
      }),
    )
    renderizarApp('/produtividade?periodo=7')
    expect(await screen.findByText('Nada concluído nesse período')).toBeInTheDocument()
    expect(await total()).toHaveTextContent('Concluídos nos últimos 7 dias0')
    expect(screen.queryByRole('region', { name: 'Concluídos por dia' })).not.toBeInTheDocument()
  })

  test('erro do servidor mostra o aviso e "Tentar de novo" busca outra vez', async () => {
    const usuario = userEvent.setup()
    servidor.use(
      http.get(`${API_URL}/relatorios/produtividade`, () =>
        HttpResponse.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falhou.' } }, { status: 500 }),
        { once: true },
      ),
    )
    renderizarApp('/produtividade')
    expect(await screen.findByText('Não foi possível carregar o que foi feito')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Total do período' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await total()).toHaveTextContent('0 tarefas · 1 compromisso')
  })
})
