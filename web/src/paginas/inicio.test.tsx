import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  // Terça, 13/10/2026, 08h (os mesmos dados de exemplo da tela Hoje).
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

describe('Início (painel)', () => {
  test('saudação com o nome da conta, data de hoje e atalho para as notificações', async () => {
    renderizarApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Bom dia, Maria' })).toBeInTheDocument()
    expect(screen.getByText('Terça-feira, 13 de outubro')).toBeInTheDocument()
    const cabecalho = screen.getByRole('heading', { level: 1 }).closest('header')!
    expect(within(cabecalho).getByRole('link', { name: 'Notificações' })).toHaveAttribute('href', '/notificacoes')
  })

  test('os números de finanças, imóveis e pessoais são os do relatório do back-end', async () => {
    const esperado = await api<RelatorioFinanceiro>('/relatorios/financeiro', {
      query: { inicio: '2026-10-01', fim: '2026-10-31' },
    })
    renderizarApp('/')

    const financas = await bloco('Finanças do mês')
    const valorDe = (rotulo: string) => within(financas).getByText(rotulo).nextElementSibling?.textContent
    expect(await within(financas).findByText('Despesas do mês')).toBeInTheDocument()
    expect(valorDe('Despesas do mês')).toBe(formatarCentavos(esperado.saidas.totalCentavos))
    expect(valorDe('Já pago')).toBe(formatarCentavos(esperado.saidas.pagoCentavos))
    expect(valorDe('A pagar')).toBe(formatarCentavos(esperado.saidas.pendenteCentavos))
    expect(valorDe('Pago no mês')).toBe(formatarCentavos(esperado.saidas.pagoNoPeriodoCentavos))
    // O critério de cada número fica escrito.
    expect(within(financas).getByText('Contas que vencem em outubro')).toBeInTheDocument()
    expect(within(financas).getByText('Pela data do pagamento')).toBeInTheDocument()

    const residencias = await bloco('Residências')
    for (const imovel of esperado.imoveis) {
      const cartao = within(residencias).getByRole('link', { name: new RegExp(imovel.nome) })
      expect(cartao).toHaveAttribute('href', `/despesas?mes=2026-10&imovel=${imovel.id}`)
      expect(within(cartao).getAllByText(reais(imovel.totalCentavos)).length).toBeGreaterThan(0)
    }

    const pessoais = await bloco('Despesas pessoais')
    expect(within(pessoais).getAllByText(reais(esperado.pessoal.totalCentavos)).length).toBeGreaterThan(0)
    expect(within(pessoais).getByRole('link', { name: /Ver lista/ })).toHaveAttribute(
      'href',
      '/despesas?mes=2026-10&imovel=pessoal',
    )
  })

  test('hoje, remédios, contas a pagar e agenda vêm das telas de cada área', async () => {
    renderizarApp('/')
    const hoje = await bloco('Hoje')
    expect(await within(hoje).findByText(/de 11 concluídas/)).toBeInTheDocument()
    expect(within(hoje).getByRole('link', { name: /Ver o dia/ })).toHaveAttribute('href', '/hoje')

    const remedios = await bloco('Remédios de hoje')
    expect((await within(remedios).findAllByText('Losartana')).length).toBeGreaterThan(0)

    const contas = await bloco('Contas a pagar')
    expect(await within(contas).findByText('Condomínio')).toBeInTheDocument()
    expect(within(contas).getByText(/Venceu há 3 dias/)).toBeInTheDocument()

    const agenda = await bloco('Próximos agendamentos')
    expect(await within(agenda).findAllByRole('link')).not.toHaveLength(0)
  })

  test('o "Tomei" do bloco de remédios marca a dose, como na tela Hoje', async () => {
    renderizarApp('/')
    const remedios = await bloco('Remédios de hoje')
    await within(remedios).findByText('1 de 4 doses tomadas')
    const linha = within(remedios).getAllByText('Losartana')[0].closest('li')!
    await userEvent.click(within(linha).getByRole('button', { name: /Tomei/ }))
    expect(await within(remedios).findByText('2 de 4 doses tomadas')).toBeInTheDocument()
  })

  test('um bloco com erro mostra o aviso e deixa tentar de novo, sem derrubar os outros', async () => {
    servidor.use(
      http.get(`${API_URL}/relatorios/financeiro`, () =>
        HttpResponse.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falhou.' } }, { status: 500 }),
      ),
    )
    renderizarApp('/')
    const financas = await bloco('Finanças do mês')
    expect(await within(financas).findByText(/Não foi possível carregar/)).toBeInTheDocument()
    expect(within(financas).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect((await within(await bloco('Remédios de hoje')).findAllByText('Losartana')).length).toBeGreaterThan(0)
  })
})
