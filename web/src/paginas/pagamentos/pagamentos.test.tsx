import { File as ArquivoNode } from 'node:buffer'
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

// Linha da tabela da Lista de despesas.
const item = async (descricao: string) =>
  (await screen.findByRole('link', { name: new RegExp(`^${descricao}`) })).closest('tr') as HTMLElement
// Cartão de conta numa aba do Cadastro de despesas.
const cartao = async (descricao: string) =>
  (await screen.findByRole('link', { name: new RegExp(`^${descricao}`) })).closest('li') as HTMLElement

describe('lista de pagamentos', () => {
  test('mostra o mês atual com totais, vencidos em destaque e parcelas', async () => {
    renderizarApp('/despesas')
    expect(await screen.findByRole('heading', { name: 'Outubro de 2026' })).toBeInTheDocument()

    const condominio = await item('Condomínio')
    expect(within(condominio).getByText('10/10/2026').closest('td')).toHaveClass('text-atraso')
    expect(within(condominio).getByText('Atrasada')).toBeInTheDocument()
    expect(within(condominio).getByText('R$ 1.250,00')).toBeInTheDocument()
    expect(screen.getByText('1 conta vencida')).toBeInTheDocument()
    expect(screen.getByLabelText('parcela 2 de 3')).toBeInTheDocument()
    const consulta = await item('Consulta cardiologista')
    expect(within(consulta).getByText('Pago')).toBeInTheDocument()
    expect(within(consulta).getByText('em 07/10/2026')).toBeInTheDocument()
  })

  test('navega entre meses e filtra por status', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/despesas')
    await item('Condomínio')

    await usuario.click(screen.getByRole('radio', { name: 'Pagos' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Condomínio/ })).not.toBeInTheDocument())
    expect(await item('Consulta cardiologista')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await screen.findByRole('heading', { name: 'Novembro de 2026' })).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma despesa com esses filtros')).toBeInTheDocument()
  })

  test('marcar como pago avisa e, sendo recorrente, cria a conta do mês seguinte', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/despesas')
    await usuario.click(await screen.findByRole('button', { name: 'Marcar Condomínio como pago' }))

    expect(await screen.findByText('Condomínio marcado como pago.')).toBeInTheDocument()
    expect(await within(await item('Condomínio')).findByText('em 13/10/2026')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await within(await item('Condomínio')).findByText('10/11/2026')).toBeInTheDocument()
  })

  test('"Desfazer" volta o pagamento para pendente', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/despesas')
    await usuario.click(await screen.findByRole('button', { name: 'Marcar Conta de luz como pago' }))
    await usuario.click(await screen.findByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByRole('button', { name: 'Marcar Conta de luz como pago' })).toBeInTheDocument()
  })
})

describe('tabela de contas', () => {
  test('mostra as colunas e a conta da equipe "A definir", paga informando o valor', async () => {
    const usuario = userEvent.setup()
    banco.membros[0].dias[0].valorPrevistoCentavos = null
    renderizarApp('/despesas')
    const tabela = await screen.findByRole('table', { name: 'Despesas do mês' })
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Descrição',
      'Valor',
      'Vencimento',
      'Parcelas',
      'Fixo',
      'Categoria',
      'Status',
      'Ações',
    ])
    const condominio = await item('Condomínio')
    expect(within(condominio).getByText('R$ 1.250,00')).toBeInTheDocument()
    // Parcelas "–" e Fixo "Sim" (todo mês).
    expect(within(condominio).getByText('–')).toBeInTheDocument()
    expect(within(condominio).getByText('Sim')).toBeInTheDocument()

    const joana = await item('Joana')
    expect(within(joana).getByText('A definir')).toBeInTheDocument()
    expect(within(joana).getByRole('cell', { name: 'Salários equipe' })).toBeInTheDocument()
    await usuario.click(within(joana).getByRole('button', { name: 'Pagar Joana' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'Pagar Joana' })
    await usuario.type(within(dialogo).getByLabelText('Valor pago a Joana'), '1.900,00')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar pagamento' }))

    expect(await screen.findByText('Joana marcado como pago.')).toBeInTheDocument()
    expect(await within(await item('Joana')).findByText('R$ 1.900,00')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('desfaz o pagamento e exclui a conta pela própria linha', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/despesas')
    const consulta = await item('Consulta cardiologista')
    await usuario.click(within(consulta).getByRole('button', { name: 'Desfazer pagamento de Consulta cardiologista' }))
    expect(
      await screen.findByRole('button', { name: 'Marcar Consulta cardiologista como pago' }),
    ).toBeInTheDocument()

    await usuario.click(within(await item('Exame de sangue')).getByRole('button', { name: 'Excluir Exame de sangue' }))
    const dialogo = await screen.findByRole('alertdialog')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Excluir conta' }))
    expect(await screen.findByText('Exame de sangue excluído.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Exame de sangue/ })).not.toBeInTheDocument())
  })
})

describe('navegação', () => {
  test('"Despesas" na barra abre a Lista de despesas; o Cadastro de despesas fica em "Mais"', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/')
    // A barra de baixo do celular (a lateral do computador também se chama "Principal").
    const barra = (await screen.findAllByRole('navigation', { name: 'Principal' })).find((nav) =>
      within(nav).queryByRole('link', { name: 'Mais' }),
    )!
    expect(within(barra).queryByRole('link', { name: 'Contas' })).not.toBeInTheDocument()
    await usuario.click(within(barra).getByRole('link', { name: 'Despesas' }))
    expect(await screen.findByRole('heading', { name: 'Lista de despesas' })).toBeInTheDocument()

    await usuario.click(within(barra).getByRole('link', { name: 'Mais' }))
    await usuario.click(within(await screen.findByRole('main')).getByRole('link', { name: 'Cadastro de despesas' }))
    expect(await screen.findByRole('heading', { name: 'Cadastro de despesas' })).toBeInTheDocument()
  })

  test('conta aberta pela Lista de despesas volta para ela ao salvar', async () => {
    const usuario = userEvent.setup()
    const { roteador } = renderizarApp('/despesas')
    await usuario.click(within(await item('Exame de sangue')).getByRole('link', { name: 'Editar Exame de sangue' }))
    await usuario.click(await screen.findByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('heading', { name: 'Lista de despesas' })).toBeInTheDocument()
    expect(roteador.state.location.pathname).toBe('/despesas')
  })
})

describe('abas de categoria', () => {
  test('cada categoria é uma aba que filtra a lista e fica na URL; sem aba abre na primeira', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    expect(await screen.findByRole('heading', { name: 'Cadastro de despesas' })).toBeInTheDocument()
    expect(await cartao('Consulta cardiologista')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultas', pressed: true })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Todas' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Exames' }))
    expect(await cartao('Exame de sangue')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Consulta cardiologista/ })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Exames', pressed: true })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Consultas' }))
    await usuario.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await screen.findByText('Nenhuma conta de consultas em novembro de 2026')).toBeInTheDocument()
  })

  test('"+ Nova" cria a categoria digitada, que vira aba e já fica aberta', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await cartao('Consulta cardiologista')

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
    await cartao('Consulta cardiologista')
    await usuario.click(screen.getByRole('button', { name: 'Exames' }))
    await cartao('Exame de sangue')
    await usuario.click(screen.getAllByRole('link', { name: /Nova/ })[0])

    expect(await screen.findByLabelText('Categoria')).toHaveDisplayValue('Exames')
    await usuario.type(screen.getByLabelText('Descrição'), 'Raio X')
    await usuario.type(screen.getByLabelText('Valor'), '180')
    await usuario.click(screen.getByRole('button', { name: 'Criar pagamento' }))

    expect(await cartao('Raio X')).toBeInTheDocument()
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
    renderizarApp('/despesas')
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
    renderizarApp('/despesas')
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

describe('contas residenciais', () => {
  test('os imóveis viram sub-abas e a conta nova já vem com o imóvel escolhido', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await cartao('Consulta cardiologista')
    // Fora da aba residencial, nada de sub-abas de imóvel
    expect(screen.queryByRole('group', { name: 'Imóveis' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Contas residenciais' }))
    const imoveis = await screen.findByRole('group', { name: 'Imóveis' })
    expect(within(imoveis).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Todos os imóveis',
      'Apartamento cobertura',
      'Casa da Serra',
    ])
    expect(await cartao('Conta de luz')).toBeInTheDocument()

    await usuario.click(within(imoveis).getByRole('button', { name: 'Casa da Serra' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Condomínio/ })).not.toBeInTheDocument())
    expect(await cartao('Conta de luz')).toBeInTheDocument()

    await usuario.click(screen.getAllByRole('link', { name: /Nova/ })[0])
    expect(await screen.findByLabelText('Imóvel (opcional)')).toHaveDisplayValue('Casa da Serra')
    expect(screen.getByLabelText('Categoria')).toHaveDisplayValue('Contas residenciais')
  })
})

describe('comprovantes', () => {
  // Veja src/test/setup.ts: o fetch do Node só envia File do próprio Node.
  const pdf = (nome: string) =>
    new ArquivoNode(['%PDF-1.4\n% teste\n%%EOF\n'], nome, { type: 'application/pdf' }) as unknown as File

  test('paga hoje, a conta convida a anexar o comprovante; anexa, aparece na lista e exclui; anexa, aparece na lista e exclui', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/despesas')
    await usuario.click(await screen.findByRole('button', { name: 'Marcar Condomínio como pago' }))
    await usuario.click(await screen.findByRole('link', { name: 'Anexar comprovante de Condomínio' }))

    const secao = await screen.findByRole('region', { name: 'Comprovantes' })
    await usuario.upload(within(secao).getByLabelText('Anexar comprovante'), pdf('boleto-condomínio.pdf'))
    expect(await screen.findByText('Comprovante adicionado.')).toBeInTheDocument()
    const lista = within(secao).getByRole('list', { name: '1 comprovante' })
    expect(within(lista).getByText('boleto-condomínio.pdf')).toBeInTheDocument()
    expect(banco.comprovantes).toHaveLength(1)

    // Na lista de contas, o clipe mostra que tem comprovante.
    await usuario.click(within(screen.getByRole('main')).getByRole('link', { name: 'Lista de despesas' }))
    const condominio = await item('Condomínio')
    expect(within(condominio).getByRole('img', { name: 'Com comprovante' })).toBeInTheDocument()
    expect(within(condominio).queryByRole('link', { name: /Anexar comprovante/ })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('link', { name: /^Condomínio/ }))
    const outraVez = await screen.findByRole('region', { name: 'Comprovantes' })
    await usuario.click(within(outraVez).getByRole('button', { name: 'Excluir boleto-condomínio.pdf' }))
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir comprovante' }))
    expect(await screen.findByText('boleto-condomínio.pdf excluído.')).toBeInTheDocument()
    expect(banco.comprovantes).toHaveLength(0)
  })

  test('conta nova ainda não tem comprovantes (só depois de salva)', async () => {
    renderizarApp('/pagamentos/novo')
    await screen.findByLabelText('Descrição')
    expect(screen.queryByRole('region', { name: 'Comprovantes' })).not.toBeInTheDocument()
  })
})
