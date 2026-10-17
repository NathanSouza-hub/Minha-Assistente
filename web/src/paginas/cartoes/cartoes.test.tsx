import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco, MARIA_ID } from '@/mocks/banco'
import type { CartaoCorpo } from '@/lib/tipos'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T12:00:00-03:00'))
  resetarBancoMock()
  await entrarComoMaria()
})
afterEach(() => {
  servidor.resetHandlers()
  localStorage.clear()
  vi.useRealTimers()
})
afterAll(() => servidor.close())

function cartaoDaMaria(dados: Partial<CartaoCorpo> = {}) {
  const cartao = {
    id: crypto.randomUUID(),
    usuarioId: MARIA_ID,
    nome: 'Nubank',
    final: '1234',
    cor: 'roxo' as const,
    diaFechamento: 3,
    diaVencimento: 10,
    limiteCentavos: null,
    ordem: 1,
    ...dados,
  }
  banco.cartoes.push(cartao)
  return cartao
}

async function lancarCompra(
  usuario: ReturnType<typeof userEvent.setup>,
  { descricao, valor, parcelas, data }: { descricao: string; valor: string; parcelas?: string; data?: string },
) {
  await usuario.click(await screen.findByRole('link', { name: 'Adicionar compra' }))
  await usuario.type(await screen.findByLabelText('Descrição'), descricao)
  await usuario.type(screen.getByLabelText('Valor total'), valor)
  if (parcelas) {
    await usuario.clear(screen.getByLabelText('Parcelas'))
    await usuario.type(screen.getByLabelText('Parcelas'), parcelas)
  }
  if (data) {
    await usuario.clear(screen.getByLabelText('Data da compra'))
    await usuario.type(screen.getByLabelText('Data da compra'), data)
  }
}

describe('aba Cartões', () => {
  test('sem cartão mostra o vazio e cadastra o primeiro', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await usuario.click(await screen.findByRole('button', { name: 'Cartões' }))
    expect(await screen.findByText('Nenhum cartão cadastrado')).toBeInTheDocument()

    await usuario.click(screen.getByRole('link', { name: 'Adicionar cartão' }))
    await usuario.type(await screen.findByLabelText('Nome do cartão'), 'Itaú')
    await usuario.type(screen.getByLabelText(/^Final/), '9876')
    await usuario.click(screen.getByLabelText('Verde'))
    await usuario.type(screen.getByLabelText('Dia do fechamento'), '3')
    await usuario.type(screen.getByLabelText('Dia do vencimento'), '10')
    await usuario.type(screen.getByLabelText('Limite (opcional)'), '5.000,00')
    await usuario.click(screen.getByRole('button', { name: 'Criar cartão' }))

    // Hoje é 13/10 e fecha dia 3: as compras de hoje vão para a fatura de novembro.
    const cartao = await screen.findByRole('button', { name: /Itaú/ })
    expect(cartao).toHaveAttribute('aria-pressed', 'true')
    expect(within(cartao).getByLabelText('final 9876')).toBeInTheDocument()
    expect(within(cartao).getByText('vence 10/nov')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Novembro de 2026' })).toBeInTheDocument()
    expect(await screen.findByText('Aberta')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma compra nesta fatura.')).toBeInTheDocument()
    expect(banco.cartoes[0]).toMatchObject({ nome: 'Itaú', cor: 'verde', limiteCentavos: 500000 })
  })

  test('compra parcelada mostra o resumo e cai uma parcela em cada fatura, com selo', async () => {
    const usuario = userEvent.setup()
    cartaoDaMaria()
    renderizarApp('/pagamentos?aba=cartoes')
    expect(await screen.findByRole('heading', { name: 'Novembro de 2026' })).toBeInTheDocument()

    await lancarCompra(usuario, { descricao: 'Geladeira', valor: '1000,00', parcelas: '3' })
    expect(screen.getByText(/1ª de R\$\s333,34 e 2× de R\$\s333,33/)).toHaveTextContent(
      'a primeira na fatura de novembro de 2026.',
    )
    await usuario.click(screen.getByRole('button', { name: 'Lançar compra' }))

    const compras = await screen.findByRole('list', { name: 'Compras da fatura' })
    expect(within(compras).getByText('Geladeira')).toBeInTheDocument()
    expect(within(compras).getByLabelText('parcela 1 de 3')).toBeInTheDocument()
    expect(within(compras).getByText('R$ 333,34')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Próxima fatura' }))
    expect(await screen.findByRole('heading', { name: 'Dezembro de 2026' })).toBeInTheDocument()
    expect(await screen.findByLabelText('parcela 2 de 3')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /Nubank/ })).getByText('R$ 333,34')).toBeInTheDocument()
  })

  test('fatura fechada é paga; compra que mexeria nela é recusada; aparece em Todas', async () => {
    const usuario = userEvent.setup()
    // Fecha dia 5: compra de 01/10 está na fatura de outubro, já fechada em 13/10.
    cartaoDaMaria({ nome: 'Visa', diaFechamento: 5, diaVencimento: 15 })
    renderizarApp('/pagamentos?aba=cartoes')
    await lancarCompra(usuario, { descricao: 'Farmácia', valor: '80,00', data: '2026-10-01' })
    await usuario.click(screen.getByRole('button', { name: 'Lançar compra' }))

    expect(await screen.findByRole('heading', { name: 'Outubro de 2026' })).toBeInTheDocument()
    expect(await screen.findByText('Fechada')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Pagar fatura' }))
    expect(await screen.findByText('Fatura de outubro de 2026 paga.')).toBeInTheDocument()
    expect(await screen.findByText('Paga')).toBeInTheDocument()

    await lancarCompra(usuario, { descricao: 'Padaria', valor: '10,00', data: '2026-10-02' })
    await usuario.click(screen.getByRole('button', { name: 'Lançar compra' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A mudança mexe na fatura de outubro de 2026, que já foi paga.',
    )

    await usuario.click(screen.getByRole('link', { name: 'Visa' }))
    await usuario.click(await screen.findByRole('button', { name: 'Todas' }))
    const fatura = (await screen.findByRole('link', { name: /^Fatura Visa/ })).closest('tr') as HTMLElement
    expect(within(fatura).getByText('Visa')).toBeInTheDocument()
    expect(within(fatura).getByText('em 13/10/2026')).toBeInTheDocument()
    // A fatura vem das compras: não volta a pendente nem é excluída pela lista.
    expect(within(fatura).queryByRole('button', { name: /Desfazer|Excluir/ })).not.toBeInTheDocument()

    await usuario.click(within(fatura).getByRole('link', { name: /^Fatura Visa/ }))
    expect(await screen.findByRole('button', { name: /Visa/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Outubro de 2026' })).toBeInTheDocument()
  })

  test('editar a compra recalcula a fatura e excluir tira a compra', async () => {
    const usuario = userEvent.setup()
    cartaoDaMaria()
    renderizarApp('/pagamentos?aba=cartoes')
    await lancarCompra(usuario, { descricao: 'Mercado', valor: '200,00' })
    await usuario.click(screen.getByRole('button', { name: 'Lançar compra' }))

    await usuario.click(await screen.findByRole('link', { name: /^Mercado/ }))
    const valor = await screen.findByLabelText('Valor total')
    await usuario.clear(valor)
    await usuario.type(valor, '250,00')
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    const compras = await screen.findByRole('list', { name: 'Compras da fatura' })
    expect(await within(compras).findByText('R$ 250,00')).toBeInTheDocument()

    await usuario.click(within(compras).getByRole('link', { name: /^Mercado/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Excluir compra' }))
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir compra' }))
    expect(await screen.findByText('Nenhuma compra nesta fatura.')).toBeInTheDocument()
    await waitFor(() => expect(banco.pagamentos.some((p) => p.cartaoId)).toBe(false))
  })
})
