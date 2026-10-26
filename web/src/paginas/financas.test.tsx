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

    // Os números que têm lista com o mesmo critério levam a ela, no mesmo mês.
    expect(within(financas).getByRole('link', { name: /A pagar/ })).toHaveAttribute(
      'href',
      '/despesas?mes=2026-10&status=pendente',
    )
    expect(within(financas).getByRole('link', { name: /Previsto a receber/ })).toHaveAttribute(
      'href',
      '/recebiveis?mes=2026-10',
    )
    expect(within(financas).queryByRole('link', { name: /Pago no mês/ })).not.toBeInTheDocument()

    // O detalhe mora nas telas de cada área: a Visão geral só tem os indicadores.
    for (const titulo of ['Contas a pagar', 'Recebíveis', 'Residências', 'Despesas pessoais'])
      expect(screen.queryByRole('region', { name: titulo })).not.toBeInTheDocument()

    // Atividades do dia ficam no Início, não aqui.
    expect(screen.queryByRole('region', { name: 'Remédios de hoje' })).not.toBeInTheDocument()
  })

  test('o painel tem o que pede atenção, os gráficos e as residências; o Balanço compara com o período anterior', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/financas')
    expect(await screen.findByRole('region', { name: 'Pede atenção' })).toBeInTheDocument()
    for (const titulo of ['Entradas e saídas', 'Resultado mês a mês', 'Despesas por categoria', 'Por residência'])
      expect(await screen.findByRole('region', { name: titulo })).toBeInTheDocument()
    expect(await within(screen.getByRole('region', { name: 'Despesas por categoria' })).findByText('Outros')).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: 'Balanço' }))
    expect(await screen.findByRole('button', { name: /Gerar PDF/ })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Comparação com o período anterior' })).toBeInTheDocument()
  })

  test('mês sem nada recebido nem pago aparece como "sem movimento"; o atual avisa que vai até hoje', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/financas')
    const fluxo = await bloco('Entradas e saídas')
    await usuario.click(await within(fluxo).findByText('Ver os números'))
    const linhas = within(fluxo)
      .getAllByRole('row')
      .slice(1)
      .map((l) => l.querySelector('th, td')!.textContent)
    expect(linhas).toHaveLength(6)
    expect(linhas.at(-1)).toMatch(/\(até hoje\)$/)
    // Os meses vazios continuam com R$ 0,00, com o aviso; nenhum valor é inventado.
    const vazios = within(fluxo)
      .getAllByRole('row')
      .filter((l) => l.textContent?.includes('sem movimento'))
    expect(vazios.length).toBeGreaterThan(0)
    for (const linha of vazios) expect(linha).toHaveTextContent(`${reais(0)}${reais(0)}`)
  })

  test('o menu da área leva às telas de Finanças', async () => {
    renderizarApp('/financas')
    const menu = await screen.findByRole('navigation', { name: 'Telas de Finanças' })
    const links = within(menu).getAllByRole('link').map((l) => l.textContent)
    expect(links).toEqual([
      'Contas a pagar',
      'Lista de despesas',
      'Pessoais',
      'Residências',
      'Equipe',
      'Recebíveis',
      'Visão geral',
    ])
    // Cartões e Categorias estão ocultos do menu por enquanto (decisão 33); o Relatório virou abas daqui.
    expect(within(menu).getByRole('link', { name: 'Visão geral' })).toHaveAttribute('aria-current', 'page')
  })

  test('o relatório fica em abas da Visão geral; o /relatorio antigo abre o Balanço', async () => {
    renderizarApp('/financas')
    const abas = await screen.findByRole('tablist', { name: 'Partes de Finanças' })
    expect(within(abas).getAllByRole('tab').map((a) => a.textContent)).toEqual([
      'Visão geral',
      'Balanço',
      'Recebíveis e pessoais',
      'Por imóvel ou categoria',
    ])
    // Na Visão geral não há período do relatório nem PDF.
    expect(await bloco('Finanças do mês')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gerar PDF' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Período')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Balanço' }))
    expect(await screen.findByRole('region', { name: 'Entradas (recebíveis)' })).toBeInTheDocument()
    expect(screen.getByLabelText('Período')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gerar PDF' })).toBeInTheDocument()
  })

  test('o endereço antigo /relatorio leva à aba Balanço', async () => {
    renderizarApp('/relatorio')
    expect(await screen.findByRole('tab', { name: 'Balanço', selected: true })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Saídas (contas)' })).toBeInTheDocument()
  })

  test('o mês escolhido vai junto para a lista', async () => {
    renderizarApp('/financas?mes=2026-11')
    const financas = await bloco('Finanças do mês')
    expect(await within(financas).findByRole('link', { name: /Despesas do mês/ })).toHaveAttribute(
      'href',
      '/despesas?mes=2026-11',
    )
  })

  test('com erro mostra o aviso e deixa tentar de novo', async () => {
    servidor.use(
      http.get(`${API_URL}/relatorios/financeiro`, () =>
        HttpResponse.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falhou.' } }, { status: 500 }),
      ),
    )
    renderizarApp('/financas')
    const financas = await bloco('Finanças do mês')
    expect(await within(financas).findByText(/Não foi possível carregar/)).toBeInTheDocument()
    expect(within(financas).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})

describe('o detalhe nas telas de cada área', () => {
  let esperado: RelatorioFinanceiro
  beforeEach(async () => {
    esperado = await api<RelatorioFinanceiro>('/relatorios/financeiro', {
      query: { inicio: '2026-10-01', fim: '2026-10-31' },
    })
  })

  test('Contas a pagar mostra as próximas contas pendentes', async () => {
    renderizarApp('/pagamentos')
    expect(await within(await bloco('Próximas contas a pagar')).findByText('Condomínio')).toBeInTheDocument()
  })

  test('Recebíveis mostra os próximos 30 dias e o previsto por origem', async () => {
    renderizarApp('/recebiveis?vista=resumo')
    await bloco('A receber nos próximos 30 dias')
    const porOrigem = await screen.findByRole('list', { name: 'Previsto no mês por origem' })
    expect(within(porOrigem).getAllByRole('listitem')).toHaveLength(esperado.entradas.porOrigem.length)
  })

  test('Residências mostra quanto cada imóvel custa no mês', async () => {
    renderizarApp('/imoveis')
    const lista = await screen.findByRole('list', { name: 'Seus imóveis' })
    for (const imovel of esperado.imoveis) {
      const cartao = within(lista).getByRole('link', { name: new RegExp(imovel.nome) })
      expect(cartao).toHaveAttribute('href', `/imoveis/${imovel.id}`)
      expect((await within(cartao).findAllByText(reais(imovel.totalCentavos))).length).toBeGreaterThan(0)
    }
  })

  test('Despesas pessoais: sem filtro de imóvel, com abas Despesas do mês, A pagar e Por categoria', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/despesas?imovel=pessoal')
    const todas = await screen.findByRole('table', { name: 'Despesas pessoais do mês' })
    // A tela já é das pessoais: o filtro de imóvel não aparece (a categoria continua).
    expect(screen.queryByLabelText('Imóvel')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument()
    const linhasDe = (tabela: HTMLElement) => within(tabela).getAllByRole('row').length - 1

    await usuario.click(screen.getByRole('tab', { name: /^A pagar/ }))
    const aPagar = await screen.findByRole('table', { name: 'Despesas pessoais a pagar' })
    expect(linhasDe(aPagar)).toBeLessThan(linhasDe(todas))
    expect(within(aPagar).queryByRole('button', { name: /^Desfazer/ })).not.toBeInTheDocument()
  })

  test('Pessoais mostra o total do mês e as categorias', async () => {
    renderizarApp('/despesas?imovel=pessoal&vista=categorias')
    expect(await screen.findByRole('heading', { level: 1, name: 'Despesas pessoais' })).toBeInTheDocument()
    const pessoais = await bloco('Despesas pessoais do mês')
    expect((await within(pessoais).findAllByText(reais(esperado.pessoal.totalCentavos))).length).toBeGreaterThan(0)
  })
})
