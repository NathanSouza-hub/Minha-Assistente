import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026. Recebíveis de exemplo: aluguel de R$ 3.200 com R$ 2.000 recebidos (dia 5),
  // dividendo recebido (dia 1), honorários atrasados (dia 11) e CDB previsto para o dia 19.
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

const linhas = async () => within(await screen.findByRole('list', { name: 'Recebíveis do mês' })).getAllByRole('link')
const titulos = async () => (await linhas()).map((l) => within(l).getAllByText(/./)[0].textContent)
// Valores formatados usam espaço sem quebra; o texto da tela chega normalizado.
const texto = (t: string) => (_: string, el: Element | null) => el?.textContent?.replace(/\s/g, ' ') === t

describe('Recebíveis', () => {
  test('lista do mês com o que já entrou, o que falta e os atrasados', async () => {
    renderizarApp('/recebiveis')
    expect(await titulos()).toEqual([
      'Dividendos Itaúsa',
      'Aluguel da sala comercial',
      'Honorários do parecer',
      'Rendimento do CDB',
    ])
    const itens = await linhas()
    expect(within(itens[1]).getByText(texto('Falta R$ 1.200,00'))).toBeInTheDocument()
    expect(within(itens[2]).getByText(/Atrasado/)).toBeInTheDocument()
    expect(within(itens[0]).getByText(/Recebido em 01\/10\/2026/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Recebidos' }))
    const recebidos = await screen.findByRole('list', { name: 'Recebíveis recebidos' })
    expect(within(recebidos).getAllByRole('link')).toHaveLength(1)
    expect(within(recebidos).getByText('Dividendos Itaúsa')).toBeInTheDocument()

    // "A receber" inclui o recebido em parte (aluguel) e os que nada entrou.
    await userEvent.click(screen.getByRole('tab', { name: /^A receber/ }))
    const aReceber = await screen.findByRole('list', { name: 'Recebíveis a receber' })
    expect(within(aReceber).getAllByRole('link')).toHaveLength(3)
    expect(within(aReceber).getByText('Aluguel da sala comercial')).toBeInTheDocument()
  })

  test('cadastra, recebe uma parte, recebe o resto e desfaz', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/recebiveis/novo')
    await usuario.type(await screen.findByLabelText('Descrição'), 'Aluguel do galpão')
    await usuario.type(screen.getByLabelText('Valor previsto'), '5.000,00')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar recebível' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Aluguel do galpão' })).toBeInTheDocument()
    const situacao = screen.getByRole('region', { name: 'Situação' })
    expect(within(situacao).getByText('A receber')).toBeInTheDocument()

    // O valor já vem com o que falta; troca por uma parte.
    const valor = screen.getByLabelText('Valor recebido')
    expect(valor).toHaveValue('5.000,00')
    await usuario.clear(valor)
    await usuario.type(valor, '1.500,00')
    await usuario.click(screen.getByRole('button', { name: 'Registrar recebimento' }))
    expect(await within(situacao).findByText('Recebido em parte')).toBeInTheDocument()
    // O campo volta com o que falta logo depois de a situação mudar.
    await vi.waitFor(() => expect(screen.getByLabelText('Valor recebido')).toHaveValue('3.500,00'))

    await usuario.click(screen.getByRole('button', { name: 'Registrar recebimento' }))
    // A situação é a linha de cima (<p>); "Recebido" também é o rótulo da coluna de valores (<dt>).
    expect(await within(situacao).findByText('Recebido', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar recebimento' })).not.toBeInTheDocument()
    const historico = screen.getByRole('region', { name: 'Histórico de recebimentos' })
    expect(within(historico).getAllByRole('listitem')).toHaveLength(2)

    await usuario.click(within(historico).getByRole('button', { name: /Desfazer recebimento de R\$\s3\.500,00/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Desfazer recebimento' }))
    expect(await within(situacao).findByText('Recebido em parte')).toBeInTheDocument()
  })

  test('origem "Outros" pede "Especifique a origem", salva e mostra a descrição', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/recebiveis/novo')
    await usuario.type(await screen.findByLabelText('Descrição'), 'Empréstimo ao João')
    await usuario.type(screen.getByLabelText('Valor previsto'), '800,00')
    expect(screen.queryByLabelText('Especifique a origem')).not.toBeInTheDocument()

    // Trocar de origem esconde o campo e apaga o que foi digitado.
    await usuario.selectOptions(screen.getByLabelText('Origem'), 'outros')
    await usuario.type(screen.getByLabelText('Especifique a origem'), 'Rascunho')
    await usuario.selectOptions(screen.getByLabelText('Origem'), 'aluguel')
    expect(screen.queryByLabelText('Especifique a origem')).not.toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Origem'), 'outros')
    const campo = screen.getByLabelText('Especifique a origem')
    expect(campo).toHaveValue('')
    expect(campo).toHaveAttribute('placeholder', 'Ex.: Juros de empréstimo, reembolso, venda de veículo')

    // Vazio (ou só espaços) não cadastra.
    await usuario.type(campo, '   ')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar recebível' }))
    expect(await screen.findByText('Especifique a origem.')).toBeInTheDocument()

    await usuario.clear(campo)
    await usuario.type(campo, 'Juros de empréstimo')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar recebível' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Empréstimo ao João' })).toBeInTheDocument()
    const situacao = screen.getByRole('region', { name: 'Situação' })
    expect(within(situacao).getByText(/Outros · Juros de empréstimo/)).toBeInTheDocument()
    // Na edição, a descrição continua no campo.
    expect(screen.getByLabelText('Origem')).toHaveValue('outros')
    expect(screen.getByLabelText('Especifique a origem')).toHaveValue('Juros de empréstimo')

    // O "← Recebíveis" do cabeçalho (o do menu não leva o mês).
    const voltar = screen.getAllByRole('link', { name: 'Recebíveis' }).find((l) => l.getAttribute('href')?.includes('?mes='))!
    await usuario.click(voltar)
    const linha = (await linhas()).find((l) => l.textContent?.includes('Empréstimo ao João'))!
    expect(within(linha).getByText(/Outros · Juros de empréstimo/)).toBeInTheDocument()
  })

  test('valor menor que o previsto: dá por recebido com o valor final', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/recebiveis')
    await usuario.click((await linhas())[3])
    const situacao = await screen.findByRole('region', { name: 'Situação' })

    const valor = screen.getByLabelText('Valor recebido')
    await usuario.clear(valor)
    await usuario.type(valor, '550,00')
    await usuario.click(screen.getByRole('switch', { name: /Foi o valor final/ }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar recebimento' }))
    expect(await within(situacao).findByText(/encerrado com menos/)).toBeInTheDocument()
  })
})
