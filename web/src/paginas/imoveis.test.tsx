import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco } from '@/mocks/banco'
import { api } from '@/lib/api'
import { formatarCentavos } from '@/lib/dinheiro'
import type { RelatorioImovel } from '@/lib/tipos'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
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

const cobertura = () => banco.imoveis.find((i) => i.nome === 'Apartamento cobertura')!
const reais = (centavos: number) => formatarCentavos(centavos).replace(/\s/g, ' ')

describe('Residências', () => {
  test('a lista leva ao resumo do imóvel, com endereço', async () => {
    renderizarApp('/imoveis')
    const link = await screen.findByRole('link', { name: /Apartamento cobertura/ })
    expect(within(link).getByText('Rua das Acácias, 450 · Apto 1201')).toBeInTheDocument()
    expect(link).toHaveAttribute('href', `/imoveis/${cobertura().id}`)
  })

  test('resumo do mês com os valores da API, categorias e as contas do imóvel', async () => {
    const esperado = await api<RelatorioImovel>(`/relatorios/imoveis/${cobertura().id}`, {
      query: { inicio: '2026-10-01', fim: '2026-10-31' },
    })
    renderizarApp(`/imoveis/${cobertura().id}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Apartamento cobertura' })).toBeInTheDocument()

    const resumo = await screen.findByRole('region', { name: 'Resumo do período' })
    expect(within(resumo).getAllByText(reais(esperado.totalCentavos)).length).toBeGreaterThan(0)
    expect(within(resumo).getByText('Conta vencida')).toBeInTheDocument()

    const categorias = screen.getByRole('region', { name: 'Por categoria' })
    for (const c of esperado.categorias) expect(within(categorias).getByText(c.nome)).toBeInTheDocument()

    // As contas e os dados ficam nas outras abas.
    expect(screen.queryByRole('region', { name: 'Contas do período' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /^Contas/ }))
    const contas = await screen.findByRole('region', { name: 'Contas do período' })
    expect(await within(contas).findByText('Condomínio')).toBeInTheDocument()
    expect(within(contas).queryByText('Conta de luz')).not.toBeInTheDocument() // é da Casa da Serra
  })

  test('6 meses mostra a evolução mês a mês', async () => {
    renderizarApp(`/imoveis/${cobertura().id}`)
    await screen.findByRole('region', { name: 'Resumo do período' })
    await userEvent.click(screen.getByRole('radio', { name: '6 meses' }))
    const evolucao = await screen.findByRole('region', { name: 'Mês a mês' })
    expect(within(evolucao).getAllByRole('listitem')).toHaveLength(6)
  })

  test('edita endereço e identificação sem mexer no nome', async () => {
    const usuario = userEvent.setup()
    renderizarApp(`/imoveis/${cobertura().id}`)
    await usuario.click(await screen.findByRole('tab', { name: 'Dados do imóvel' }))
    const endereco = await screen.findByLabelText('Endereço (opcional)')
    await usuario.clear(endereco)
    await usuario.type(endereco, 'Av. Beira-Mar, 900')
    await usuario.click(screen.getByRole('button', { name: 'Salvar dados' }))
    expect(await screen.findByText('Av. Beira-Mar, 900 · Apto 1201')).toBeInTheDocument()
    expect(cobertura().endereco).toBe('Av. Beira-Mar, 900')
    expect(cobertura().nome).toBe('Apartamento cobertura')
  })
})
