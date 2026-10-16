import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco } from '@/mocks/banco'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Hoje é 13/10/2026; a Joana (dados de exemplo) recebe por mês no dia 18, R$ 1.800,00.
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

const pagamentosDoMes = () => screen.findByRole('list', { name: 'Pagamentos da equipe do mês' })
const itemDe = async (nome: string) =>
  (await within(await pagamentosDoMes()).findByRole('link', { name: new RegExp(`^${nome}`) })).closest(
    'li',
  ) as HTMLElement

describe('aba Salários equipe', () => {
  test('mostra os pagamentos da equipe no mês e as pessoas cadastradas', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await usuario.click(await screen.findByRole('button', { name: 'Salários equipe' }))

    const joana = await itemDe('Joana')
    expect(within(joana).getByText('R$ 1.800,00')).toBeInTheDocument()
    expect(within(joana).getByText('Vence em 5 dias')).toBeInTheDocument()

    const equipe = await screen.findByRole('list', { name: 'Pessoas da equipe' })
    expect(within(equipe).getByText('Cuidadora · Por mês · dia 18')).toBeInTheDocument()
  })

  test('cadastra plantonista sem valor: a conta vem "a definir" e é paga informando o valor', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos?aba=equipe')
    await usuario.click(await screen.findByRole('link', { name: 'Adicionar pessoa' }))

    await usuario.type(await screen.findByLabelText('Nome'), 'Carla')
    await usuario.type(screen.getByLabelText('Função (opcional)'), 'Enfermeira')
    await usuario.click(screen.getByRole('radio', { name: 'Plantão' }))
    await usuario.type(screen.getByLabelText('Dia (1º pagamento)'), '20')
    await usuario.click(screen.getByRole('button', { name: 'Outro dia' }))
    await usuario.type(screen.getByLabelText('Dia (2º pagamento)'), '5')
    await usuario.type(screen.getByLabelText('Chave PIX (opcional)'), '11999990000')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar pessoa' }))

    // Cadastrada em 13/10: o dia 5 de outubro já passou, então só a de 20/10 aparece neste mês.
    const carla = await itemDe('Carla')
    expect(within(carla).getByText('A definir')).toBeInTheDocument()
    expect(screen.getByText('+ 1 a definir')).toBeInTheDocument()
    expect(banco.pagamentos.filter((p) => p.descricao === 'Carla').map((p) => p.vencimento).sort()).toEqual([
      '2026-10-20',
      '2026-11-05',
      '2026-11-20',
    ])

    await usuario.click(within(carla).getByRole('button', { name: 'Pagar Carla' }))
    await usuario.click(within(carla).getByRole('button', { name: 'Confirmar pagamento' }))
    expect(within(carla).getByText('Digite o valor pago, por exemplo 1.500,00.')).toBeInTheDocument()
    await usuario.type(within(carla).getByLabelText('Valor pago a Carla'), '2.000,00')
    await usuario.click(within(carla).getByRole('button', { name: 'Confirmar pagamento' }))

    expect(await screen.findByText('Carla marcado como pago.')).toBeInTheDocument()
    const paga = await itemDe('Carla')
    expect(await within(paga).findByText('Pago em 13/10/2026')).toBeInTheDocument()
    expect(within(paga).getByText('R$ 2.000,00')).toBeInTheDocument()
  })

  test('a conta da equipe abre com a chave PIX e muda só valor, data e observações', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos?aba=equipe')
    await usuario.click(within(await itemDe('Joana')).getByRole('link'))

    expect(await screen.findByRole('heading', { name: 'Pagamento de Joana' })).toBeInTheDocument()
    expect(screen.getByText('joana@exemplo.com')).toBeInTheDocument()
    const valor = screen.getByLabelText('Valor (deixe em branco se ainda não sabe)')
    await usuario.clear(valor)
    await usuario.type(valor, '1.900,00')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(within(await itemDe('Joana')).getByText('R$ 1.900,00')).toBeInTheDocument()

    await usuario.click(within(await itemDe('Joana')).getByRole('link'))
    await usuario.click(await screen.findByRole('button', { name: 'Excluir pagamento' }))
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir pagamento' }))
    expect(await screen.findByText('Nenhum pagamento da equipe em outubro de 2026.')).toBeInTheDocument()
  })

  test('desativar a pessoa tira as contas futuras e ela fica marcada como inativa', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos?aba=equipe')
    await itemDe('Joana')
    const equipe = await screen.findByRole('list', { name: 'Pessoas da equipe' })
    await usuario.click(within(equipe).getByRole('link', { name: /Joana/ }))

    await usuario.click(await screen.findByRole('switch', { name: /Ativa/ }))
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Nenhum pagamento da equipe em outubro de 2026.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('(inativa)')).toBeInTheDocument())
  })
})
