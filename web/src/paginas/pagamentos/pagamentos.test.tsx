import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Só o relógio é falso (timers reais para o userEvent). Os dados de exemplo são relativos a hoje.
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

const item = async (descricao: string) =>
  (await screen.findByRole('link', { name: new RegExp(`^${descricao}`) })).closest('li') as HTMLElement

describe('lista de pagamentos', () => {
  test('mostra o mês atual com totais, vencidos em destaque e parcelas', async () => {
    renderizarApp('/pagamentos')
    expect(await screen.findByRole('heading', { name: 'Outubro de 2026' })).toBeInTheDocument()

    const condominio = await item('Condomínio')
    expect(within(condominio).getByText('Venceu há 3 dias')).toBeInTheDocument()
    expect(within(condominio).getByText('R$ 1.250,00')).toBeInTheDocument()
    expect(screen.getByText('1 conta vencida')).toBeInTheDocument()
    expect(screen.getByLabelText('parcela 2 de 3')).toBeInTheDocument()
    expect(within(await item('Consulta cardiologista')).getByText('Pago em 07/10/2026')).toBeInTheDocument()
  })

  test('navega entre meses e filtra por status', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await item('Condomínio')

    await usuario.click(screen.getByRole('radio', { name: 'Pagos' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Condomínio/ })).not.toBeInTheDocument())
    expect(await item('Consulta cardiologista')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await screen.findByRole('heading', { name: 'Novembro de 2026' })).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma conta com esses filtros')).toBeInTheDocument()
  })

  test('marcar como pago avisa e, sendo recorrente, cria a conta do mês seguinte', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await usuario.click(await screen.findByRole('button', { name: 'Marcar Condomínio como pago' }))

    expect(await screen.findByText('Condomínio marcado como pago.')).toBeInTheDocument()
    expect(await within(await item('Condomínio')).findByText('Pago em 13/10/2026')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await within(await item('Condomínio')).findByText('Vence 10/11')).toBeInTheDocument()
  })

  test('"Desfazer" volta o pagamento para pendente', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await usuario.click(await screen.findByRole('button', { name: 'Marcar Conta de luz como pago' }))
    await usuario.click(await screen.findByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByRole('button', { name: 'Marcar Conta de luz como pago' })).toBeInTheDocument()
  })
})

describe('abas de categoria', () => {
  test('cada categoria é uma aba que filtra a lista e fica na URL', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await item('Condomínio')
    expect(screen.getByRole('button', { name: 'Todas', pressed: true })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Exames' }))
    expect(await item('Exame de sangue')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Condomínio/ })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Exames', pressed: true })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Honorários médicos' }))
    expect(await screen.findByText('Nenhuma conta de honorários médicos em outubro de 2026')).toBeInTheDocument()
  })

  test('"+ Nova" cria a categoria digitada, que vira aba e já fica aberta', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await item('Condomínio')

    await usuario.click(screen.getByRole('button', { name: 'Nova' }))
    await usuario.type(screen.getByLabelText('Nome da categoria'), 'exames{Enter}')
    expect(await screen.findByText('Você já tem uma categoria com esse nome.')).toBeInTheDocument()

    await usuario.clear(screen.getByLabelText('Nome da categoria'))
    await usuario.type(screen.getByLabelText('Nome da categoria'), 'Plano de saúde')
    await usuario.click(screen.getByRole('button', { name: 'Criar categoria' }))
    expect(await screen.findByRole('button', { name: 'Plano de saúde', pressed: true })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da categoria')).not.toBeInTheDocument()
    expect(await screen.findByText('Nenhuma conta de plano de saúde em outubro de 2026')).toBeInTheDocument()
  })

  test('conta nova aberta numa aba já vem com a categoria e volta para a aba', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await item('Condomínio')
    await usuario.click(screen.getByRole('button', { name: 'Exames' }))
    await item('Exame de sangue')
    await usuario.click(screen.getAllByRole('link', { name: /Nova/ })[0])

    expect(await screen.findByLabelText('Categoria')).toHaveDisplayValue('Exames')
    await usuario.type(screen.getByLabelText('Descrição'), 'Raio X')
    await usuario.type(screen.getByLabelText('Valor'), '180')
    await usuario.click(screen.getByRole('button', { name: 'Criar pagamento' }))

    expect(await item('Raio X')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exames', pressed: true })).toBeInTheDocument()
  })
})

describe('formulário de pagamento', () => {
  test('"+ Nova categoria…" abre o campo e seleciona a categoria criada', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos/novo')
    await usuario.selectOptions(await screen.findByLabelText('Categoria'), '+ Nova categoria…')
    await usuario.type(screen.getByLabelText('Nome da nova categoria'), 'Pets{Enter}')

    await waitFor(() => expect(screen.getByLabelText('Categoria')).toHaveDisplayValue('Pets'))
    expect(screen.queryByLabelText('Nome da nova categoria')).not.toBeInTheDocument()
  })

  test('barra campos obrigatórios antes de enviar', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos/novo')
    await usuario.click(await screen.findByRole('button', { name: 'Criar pagamento' }))
    expect(await screen.findByText('Informe a descrição.')).toBeInTheDocument()
    expect(screen.getByText('Digite o valor, por exemplo 150,00.')).toBeInTheDocument()
    expect(screen.getByText('Escolha a categoria.')).toBeInTheDocument()
  })

  test('cria um parcelamento: N parcelas, valor de cada uma e mês a mês', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos/novo')
    await usuario.type(await screen.findByLabelText('Descrição'), 'Sofá novo')
    await usuario.type(screen.getByLabelText('Valor'), '450,00')
    await usuario.selectOptions(screen.getByLabelText('Categoria'), 'Parcelamentos')
    await usuario.click(screen.getByRole('radio', { name: /^Parcelado/ }))
    const parcelas = screen.getByLabelText('Quantas parcelas?')
    await usuario.clear(parcelas)
    await usuario.type(parcelas, '3')
    expect(screen.getByText('3 parcelas de R$ 450,00, total de R$ 1.350,00.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Criar parcelas' }))

    expect(await screen.findByText('3 parcelas criadas.')).toBeInTheDocument()
    expect(await screen.findByLabelText('parcela 1 de 3')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await screen.findByLabelText('parcela 2 de 3')).toBeInTheDocument()
  })

  test('edita o valor de um pagamento', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await usuario.click(await screen.findByRole('link', { name: /^Exame de sangue/ }))
    const valor = await screen.findByLabelText('Valor')
    expect(valor).toHaveValue('180,00')
    await usuario.clear(valor)
    await usuario.type(valor, '210,50')
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await within(await item('Exame de sangue')).findByText('R$ 210,50')).toBeInTheDocument()
  })

  test('exclui depois de confirmar', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await usuario.click(await screen.findByRole('link', { name: /^Exame de sangue/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Excluir pagamento' }))
    const dialogo = await screen.findByRole('alertdialog')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Excluir pagamento' }))
    expect(await screen.findByText('Pagamento excluído.')).toBeInTheDocument()
    // A tela do item apagado não pode buscar de novo e mostrar "não encontrado".
    await new Promise((r) => setTimeout(r, 300))
    expect(screen.queryByText(/não encontrado/)).not.toBeInTheDocument()
    await item('Condomínio')
    expect(screen.queryByRole('link', { name: /^Exame de sangue/ })).not.toBeInTheDocument()
  })
})

describe('imóveis', () => {
  test('nome repetido aparece no campo', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/imoveis')
    await usuario.type(await screen.findByLabelText('Nome do imóvel'), 'Casa da Serra')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar imóvel' }))
    expect(await screen.findByText('Você já tem um imóvel com esse nome.')).toBeInTheDocument()
  })

  test('imóvel com pagamentos não é excluído e a pessoa é avisada', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/imoveis')
    await usuario.click(await screen.findByRole('button', { name: 'Excluir Casa da Serra' }))
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir imóvel' }))
    expect(await screen.findByText(/Este imóvel tem pagamentos ligados/)).toBeInTheDocument()
    expect(screen.getByText('Casa da Serra')).toBeInTheDocument()
  })

  test('adiciona e renomeia', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/imoveis')
    await usuario.type(await screen.findByLabelText('Nome do imóvel'), 'Sítio')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar imóvel' }))
    await usuario.click(await screen.findByRole('button', { name: 'Renomear Sítio' }))
    const campo = screen.getByLabelText('Novo nome para Sítio')
    await usuario.clear(campo)
    await usuario.type(campo, 'Sítio Boa Vista')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nome' }))
    expect(await screen.findByText('Sítio Boa Vista')).toBeInTheDocument()
  })
})

describe('relatório de gastos', () => {
  test('mostra totais do mês e separa por imóvel ou categoria', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/relatorio')
    const totais = await screen.findByText('Previsto', { selector: 'dt' })
    // Pendentes de outubro: 1.250 + 238,90 + 1.800 + 180 + 399,90 (parcela 2/3)
    expect(within(totais.closest('div')!).getByText('R$ 3.868,80')).toBeInTheDocument()
    expect(screen.getByText('Sem imóvel')).toBeInTheDocument()

    await usuario.click(screen.getByRole('radio', { name: 'Categoria' }))
    expect(await screen.findByText('Contas residenciais')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Por categoria' })).toBeInTheDocument()
  })
})
