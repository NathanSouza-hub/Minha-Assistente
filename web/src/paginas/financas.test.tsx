import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'
import { api, API_URL } from '@/lib/api'
import { formatarCentavos } from '@/lib/dinheiro'
import type { RelatorioFinanceiro } from '@/lib/tipos'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026, 08h.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T08:00:00-03:00'))
  resetarBancoMock()
  await entrarComoMaria()
})
afterEach(() => {
  servidor.resetHandlers()
  localStorage.clear()
  vi.useRealTimers()
})
afterAll(() => servidor.close())

const bloco = async (titulo: string) => screen.findByRole('region', { name: titulo })
// O valor formatado usa espaço sem quebra; o texto da tela chega normalizado com espaço comum.
const reais = (centavos: number) => formatarCentavos(centavos).replace(/\s/g, ' ')

describe('Finanças → Visão geral', () => {
  test('os números do mês são os do relatório do back-end, com o critério escrito', async () => {
    const esperado = await api<RelatorioFinanceiro>('/relatorios/financeiro', {
      query: { inicio: '2026-10-01', fim: '2026-10-31' },
    })
    renderizarApp('/financas')
    expect(await screen.findByRole('heading', { level: 1, name: 'Finanças' })).toBeInTheDocument()

    const financas = await bloco('Finanças do mês')
    const valorDe = (rotulo: string) => within(financas).getByText(rotulo).nextElementSibling?.textContent
    expect(await within(financas).findByText('Despesas do mês')).toBeInTheDocument()
    expect(valorDe('Despesas do mês')).toBe(formatarCentavos(esperado.saidas.totalCentavos))
    expect(valorDe('Já pago')).toBe(formatarCentavos(esperado.saidas.pagoCentavos))
    expect(valorDe('A pagar')).toBe(formatarCentavos(esperado.saidas.pendenteCentavos))
    expect(valorDe('Pago no mês')).toBe(formatarCentavos(esperado.saidas.pagoNoPeriodoCentavos))
    expect(valorDe('Previsto a receber')).toBe(formatarCentavos(esperado.entradas.totalCentavos))
    expect(valorDe('Recebido no mês')).toBe(formatarCentavos(esperado.entradas.recebidoNoPeriodoCentavos))
    expect(valorDe('Saldo realizado')).toBe(formatarCentavos(esperado.saldo.realizadoCentavos))
    expect(valorDe('Saldo projetado')).toBe(formatarCentavos(esperado.saldo.projetadoCentavos))
    expect(within(financas).getByText('Contas que vencem em outubro')).toBeInTheDocument()
    expect(within(financas).getByText('Pela data do pagamento')).toBeInTheDocument()

    const residencias = await bloco('Residências')
    for (const imovel of esperado.imoveis) {
      const cartao = await within(residencias).findByRole('link', { name: new RegExp(imovel.nome) })
      expect(cartao).toHaveAttribute('href', `/imoveis/${imovel.id}`)
      expect(within(cartao).getAllByText(reais(imovel.totalCentavos)).length).toBeGreaterThan(0)
    }

    const pessoais = await bloco('Despesas pessoais')
    expect(within(pessoais).getAllByText(reais(esperado.pessoal.totalCentavos)).length).toBeGreaterThan(0)
    expect(await within(await bloco('Contas a pagar')).findByText('Condomínio')).toBeInTheDocument()

    // Atividades do dia ficam no Início, não aqui.
    expect(screen.queryByRole('region', { name: 'Remédios de hoje' })).not.toBeInTheDocument()
  })

  test('o menu da área leva às telas de Finanças', async () => {
    renderizarApp('/financas')
    const menu = await screen.findByRole('navigation', { name: 'Telas de Finanças' })
    const links = within(menu).getAllByRole('link').map((l) => l.textContent)
    expect(links).toEqual([
      'Visão geral',
      'Contas a pagar',
      'Lista de despesas',
      'Pessoais',
      'Residências',
      'Equipe',
      'Recebíveis',
      'Cartões',
      'Relatório',
      'Categorias',
    ])
    expect(within(menu).getByRole('link', { name: 'Visão geral' })).toHaveAttribute('aria-current', 'page')
  })

  test('um bloco com erro mostra o aviso e deixa tentar de novo, sem derrubar os outros', async () => {
    servidor.use(
      http.get(`${API_URL}/relatorios/financeiro`, () =>
        HttpResponse.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falhou.' } }, { status: 500 }),
      ),
    )
    renderizarApp('/financas')
    const financas = await bloco('Finanças do mês')
    expect(await within(financas).findByText(/Não foi possível carregar/)).toBeInTheDocument()
    expect(within(financas).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(await within(await bloco('Contas a pagar')).findByText('Condomínio')).toBeInTheDocument()
  })
})
