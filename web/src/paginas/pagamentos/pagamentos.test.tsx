import { File as ArquivoNode } from 'node:buffer'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco } from '@/mocks/banco'
import { garantirContasEquipe } from '@/mocks/equipe'
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
// Linha da lista do grupo aberto no Cadastro de despesas (não a de "Próximas contas a pagar").
const cartao = async (descricao: string) =>
  (
    await within(await screen.findByRole('region', { name: /^Contas.* do mês$/ })).findByRole('link', {
      name: new RegExp(`^${descricao}`),
    })
  ).closest('li') as HTMLElement
/** Conta na lista do grupo aberto (null se não está nela). */
const naAba = (nome: RegExp) => {
  const lista = screen.queryByRole('region', { name: /^Contas.* do mês$/ })
  return lista && within(lista).queryByRole('link', { name: nome })
}
/** O select "Grupo de contas" do painel de filtros. */
const grupo = () => screen.getByLabelText('Grupo de contas') as HTMLSelectElement
const opcoesDe = (select: HTMLElement) => within(select).getAllByRole('option').map((o) => o.textContent)

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
    // Como salvar a pessoa com o valor "a definir": as contas dela são refeitas (abrir a lista não grava).
    banco.membros[0].dias[0].valorPrevistoCentavos = null
    banco.pagamentos = banco.pagamentos.filter((p) => p.membroId !== banco.membros[0].id)
    garantirContasEquipe(banco.membros[0].usuarioId)
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
  test('a barra tem as 5 áreas; Finanças leva à Lista de despesas e às Contas a pagar', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/')
    // A barra de baixo do celular (a lateral do computador também se chama "Principal").
    const barra = (await screen.findAllByRole('navigation', { name: 'Principal' })).find((nav) =>
      nav.className.includes('fixed'),
    )!
    expect(within(barra).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Início',
      'Finanças',
      'Agenda',
      'Remédios', // a área Medicamentos; o nome completo não cabe na barra
      'Lembretes',
    ])
    await usuario.click(within(barra).getByRole('link', { name: 'Finanças' }))
    const menu = await screen.findByRole('navigation', { name: 'Telas de Finanças' })
    await usuario.click(within(menu).getByRole('link', { name: 'Lista de despesas' }))
    expect(await screen.findByRole('heading', { name: 'Lista de despesas' })).toBeInTheDocument()

    await usuario.click(within(await screen.findByRole('navigation', { name: 'Telas de Finanças' })).getByRole('link', { name: 'Contas a pagar' }))
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

describe('grupos de contas', () => {
  test('cada categoria é um grupo que filtra a lista e fica na URL; sem grupo abre na primeira', async () => {
    const usuario = userEvent.setup()
    const { roteador } = renderizarApp('/pagamentos')
    expect(await screen.findByRole('heading', { name: 'Cadastro de despesas' })).toBeInTheDocument()
    expect(await cartao('Conta de luz')).toBeInTheDocument()
    expect(grupo()).toHaveDisplayValue('Contas residenciais')
    // Sem "Todas"; consultas, exames e parcelamentos não são grupos (migration 22): ficam em "Outros".
    // Cartões está oculto por enquanto (decisão 33).
    expect(opcoesDe(grupo())).toEqual(['Contas residenciais', 'Outros', 'Salários equipe'])

    await usuario.selectOptions(grupo(), 'Outros')
    expect(await cartao('Exame de sangue')).toBeInTheDocument()
    expect(await cartao('Geladeira nova')).toBeInTheDocument()
    await waitFor(() => expect(naAba(/^Conta de luz/)).toBeNull())
    expect(grupo()).toHaveDisplayValue('Outros')
    expect(roteador.state.location.search).toContain('aba=')
  })

  test('"Nova categoria" cria a categoria digitada, que já fica aberta', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await cartao('Conta de luz')

    await usuario.click(screen.getByRole('button', { name: 'Nova categoria' }))
    await usuario.type(screen.getByLabelText('Nome da categoria'), 'outros{Enter}')
    expect(await screen.findByText('Você já tem uma categoria com esse nome.')).toBeInTheDocument()

    await usuario.clear(screen.getByLabelText('Nome da categoria'))
    await usuario.type(screen.getByLabelText('Nome da categoria'), 'Plano de saúde')
    await usuario.click(screen.getByRole('button', { name: 'Criar categoria' }))
    await waitFor(() => expect(grupo()).toHaveDisplayValue('Plano de saúde'))
    expect(screen.queryByLabelText('Nome da categoria')).not.toBeInTheDocument()
    expect(await screen.findByText('Nenhuma conta de plano de saúde em outubro de 2026')).toBeInTheDocument()
  })

  test('conta nova aberta num grupo já vem com a categoria e volta para o grupo', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await cartao('Conta de luz')
    await usuario.selectOptions(grupo(), 'Outros')
    await cartao('Exame de sangue')
    await usuario.click(screen.getAllByRole('link', { name: /Nova/ })[0])

    expect(await screen.findByLabelText('Categoria')).toHaveDisplayValue('Outros')
    await usuario.type(screen.getByLabelText('Descrição'), 'Raio X')
    await usuario.type(screen.getByLabelText('Valor'), '180')
    await usuario.click(screen.getByRole('button', { name: 'Criar pagamento' }))

    expect(await cartao('Raio X')).toBeInTheDocument()
    expect(grupo()).toHaveDisplayValue('Outros')
  })

  test('conta aberta pela lista volta para o grupo ao salvar', async () => {
    const usuario = userEvent.setup()
    const { roteador } = renderizarApp('/pagamentos')
    await usuario.click(within(await cartao('Conta de luz')).getByRole('link', { name: /^Conta de luz/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Salvar alterações' }))
    expect(await cartao('Conta de luz')).toBeInTheDocument()
    expect(roteador.state.location.pathname).toBe('/pagamentos')
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
    await usuario.selectOptions(screen.getByLabelText('Categoria'), 'Outros')
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
    await usuario.click(await screen.findByRole('button', { name: 'Novo imóvel' }))
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
    // O formulário fica atrás do "Novo imóvel" e fecha depois de adicionar.
    expect(screen.queryByLabelText('Nome do imóvel')).not.toBeInTheDocument()
    await usuario.click(await screen.findByRole('button', { name: 'Novo imóvel' }))
    await usuario.type(await screen.findByLabelText('Nome do imóvel'), 'Sítio')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar imóvel' }))
    await waitFor(() => expect(screen.queryByLabelText('Nome do imóvel')).not.toBeInTheDocument())
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
    renderizarApp('/financas?vista=balanco')
    // Aba Balanço (a primeira): entradas, saídas e saldo.
    expect(await screen.findByRole('region', { name: 'Entradas (recebíveis)' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Saídas (contas)' })).toBeInTheDocument()
    const saldo = screen.getByRole('region', { name: 'Saldo do período' })
    expect(within(saldo).getByText('Saldo realizado')).toBeInTheDocument()
    expect(within(saldo).getByText('Saldo projetado')).toBeInTheDocument()
    expect(screen.queryByText('Sem imóvel')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: 'Recebíveis e pessoais' }))
    expect(within(await screen.findByRole('region', { name: 'Recebíveis por origem' })).getByText('Aluguel')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Despesas pessoais (sem imóvel)' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: 'Por imóvel ou categoria' }))
    await screen.findByText('Sem imóvel')
    const totais = screen.getAllByText('Previsto', { selector: 'dt' })[0]
    // Pendentes de outubro: 1.250 + 238,90 + 1.800 + 180 + 399,90 (parcela 2/3)
    expect(within(totais.closest('div')!).getByText('R$ 3.868,80')).toBeInTheDocument()

    await usuario.click(screen.getByRole('radio', { name: 'Categoria' }))
    expect(await screen.findByText('Contas residenciais')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Por categoria' })).toBeInTheDocument()
  })
})

describe('PDF do relatório', () => {
  test('"Gerar PDF" baixa o relatório do período com os números da tela', async () => {
    const criarUrl = vi.fn((_arquivo: Blob) => 'blob:relatorio')
    URL.createObjectURL = criarUrl
    URL.revokeObjectURL = vi.fn()
    const baixados: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      baixados.push(this.download)
    })
    const usuario = userEvent.setup()
    renderizarApp('/financas?vista=balanco')
    const gerar = await screen.findByRole('button', { name: 'Gerar PDF' })
    await waitFor(() => expect(gerar).toBeEnabled())
    await usuario.click(gerar)

    expect(await screen.findByText('PDF do relatório gerado.')).toBeInTheDocument()
    expect(baixados).toEqual(['relatorio-2026-10-01-a-2026-10-31.pdf'])
    const pdf = await criarUrl.mock.calls[0][0].text()
    expect(pdf.startsWith('%PDF-')).toBe(true)
    // O mesmo previsto da aba "Por imóvel ou categoria" (veja o teste acima).
    expect(pdf).toContain('R$ 3.868,80')
    // Acentos ficam na codificação das fontes do PDF; basta o começo.
    expect(pdf).toContain('Gastos por im')
  })
})

describe('contas residenciais', () => {
  test('o imóvel filtra o grupo e a conta nova já vem com o imóvel escolhido', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/pagamentos')
    await cartao('Conta de luz')
    const imovel = screen.getByLabelText('Imóvel')
    expect(opcoesDe(imovel)).toEqual(['Todos', 'Apartamento cobertura', 'Casa da Serra'])

    await usuario.selectOptions(imovel, 'Casa da Serra')
    await waitFor(() => expect(naAba(/^Condomínio/)).toBeNull())
    expect(await cartao('Conta de luz')).toBeInTheDocument()
    // Recolhido, o painel mostra o que está escolhido.
    expect(screen.getByText('Contas residenciais · Casa da Serra')).toBeInTheDocument()

    await usuario.click(screen.getAllByRole('link', { name: /Nova/ })[0])
    expect(await screen.findByLabelText('Destino')).toHaveDisplayValue('Casa da Serra')
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
