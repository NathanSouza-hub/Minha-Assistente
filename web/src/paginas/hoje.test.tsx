import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'
import { api, API_URL } from '@/lib/api'
import { salvarToken } from '@/lib/sessao'
import type { Sessao } from '@/lib/tipos'

const servidor = setupServer(...handlers)

const relogio = (iso: string) => vi.setSystemTime(new Date(iso))

// O anel mostra "1 de 4" grande e "doses tomadas" embaixo: o texto inteiro está no bloco.
const esperarDoses = (texto: string) =>
  waitFor(() => expect(screen.getByRole('region', { name: 'Doses do dia' })).toHaveTextContent(texto))

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026, 08h. Dados de exemplo da Maria: 4 doses (1 tomada), fisioterapia 9h e
  // consulta 15h, 4 compromissos com hora e 1 sem (1 feito), condomínio vencido no dia 10.
  vi.useFakeTimers({ toFake: ['Date'] })
  relogio('2026-10-13T08:00:00-03:00')
  resetarBancoMock()
})
afterEach(() => {
  servidor.resetHandlers()
  localStorage.clear()
  vi.useRealTimers()
})
afterAll(() => servidor.close())

// As atrasadas ficam numa seção em cima; as linhas vêm na ordem da tela (atrasadas primeiro).
// O bloco "Agora" repete o título de uma linha: as buscas ficam dentro das listas.
const linhas = async () => {
  const doDia = await screen.findByRole('region', { name: /^Atividades d/ })
  const atras = screen.queryByRole('region', { name: 'Atrasadas' })
  return [...(atras ? within(atras).getAllByRole('listitem') : []), ...within(doDia).queryAllByRole('listitem')]
}
const linhaDe = async (texto: string) => (await linhas()).find((l) => within(l).queryByText(texto))!
const atrasadas = () => screen.queryByRole('region', { name: 'Atrasadas' })
const destaque = () => screen.findByRole('region', { name: /^(Agora|Próxima) · / })

/** Abre o ⋯ da linha e toca na opção. */
async function opcao(usuario: ReturnType<typeof userEvent.setup>, titulo: string, nome: string) {
  await usuario.click(within(await linhaDe(titulo)).getByRole('button', { name: `Mais opções: ${titulo}` }))
  await usuario.click(await screen.findByRole('button', { name: nome }))
}

describe('tela Hoje: tarefas do dia', () => {
  beforeEach(entrarComoMaria)

  test('Início: saudação, progresso, atrasadas em cima, o resto em ordem de horário, o "dia todo" no fim', async () => {
    renderizarApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Bom dia, Maria' })).toBeInTheDocument()
    expect(screen.getByText('Terça-feira, 13 de outubro')).toBeInTheDocument()
    expect(await screen.findByText('2 de 11 feitas')).toBeInTheDocument()
    // No lugar do antigo resumo financeiro: o Verso do dia, com a referência e a tradução.
    const verso = screen.getByRole('region', { name: 'Verso do dia' })
    expect(within(verso).getByText(/Almeida \(domínio público\)/)).toBeInTheDocument()
    expect(within(verso).getByRole('button', { name: 'Ler o capítulo' })).toBeInTheDocument()
    expect(within(screen.getByRole('complementary', { name: 'Resumo do dia' })).getByText('doses de hoje')).toBeInTheDocument()
    // Sem indicadores nem finanças no Início.
    expect(screen.queryByText('Despesas do mês')).not.toBeInTheDocument()

    const titulos = (await linhas()).map((l) => within(l).getByRole('link').querySelector('p')!.textContent)
    expect(titulos[0]).toBe('Condomínio')
    expect(within(atrasadas()!).getAllByRole('listitem')).toHaveLength(1)
    expect(titulos.slice(1, 5)).toEqual(['Omeprazol', 'Losartana', 'Ler e-mails', 'Vitamina D'])
    expect(titulos.at(-1)).toBe('Regar as plantas')

    // Dose sempre com a unidade; conta com valor, imóvel e o dia em que venceu.
    expect(within(await linhaDe('Vitamina D')).getByText('1 gota de 50.000 UI')).toBeInTheDocument()
    const condominio = await linhaDe('Condomínio')
    expect(within(condominio).getByText('R$ 1.250,00 · Apartamento cobertura · Venceu em 10/10')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dia todo' })).toBeInTheDocument()

    // Feito: círculo marcado e título riscado.
    const omeprazol = await linhaDe('Omeprazol')
    expect(within(omeprazol).getByRole('button', { name: 'Tomei: Omeprazol' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(omeprazol).getByText('Omeprazol')).toHaveClass('line-through')
  })

  test('"Agora" destaca o que está acontecendo e o que vem depois; "Feito" passa para a seguinte', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/')
    const bloco = await destaque()
    expect(bloco).toHaveAccessibleName('Agora · 08:00')
    expect(within(bloco).getByRole('heading', { name: 'Losartana' })).toBeInTheDocument()
    expect(within(bloco).getByText('Depois:')).toBeInTheDocument()
    // Na lista, a mesma linha leva o "agora" ao lado do horário.
    expect(within(await linhaDe('Losartana')).getByText('· agora')).toBeInTheDocument()

    await usuario.click(within(bloco).getByRole('button', { name: 'Tomei: Losartana' }))
    expect(await screen.findByText('3 de 11 feitas')).toBeInTheDocument()
    expect(within(await linhaDe('Losartana')).getByRole('button', { name: 'Tomei: Losartana' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await waitFor(async () =>
      expect(within(await destaque()).queryByRole('heading', { name: 'Losartana' })).not.toBeInTheDocument(),
    )
  })

  test('horário que passou há mais de uma hora fica em vermelho nas atrasadas; o de agora vai para o destaque', async () => {
    relogio('2026-10-13T09:30:00-03:00')
    renderizarApp('/hoje')
    const bloco = await destaque()
    expect(bloco).toHaveAccessibleName('Agora · 09:00')
    const losartana = await linhaDe('Losartana')
    expect(within(losartana).getByText('08:00')).toHaveClass('text-atraso')
    expect(within(losartana).getByText('(atrasado)')).toBeInTheDocument()
    // Das três das 09:00, a que está no destaque sai das atrasadas e fica na lista do dia.
    const titulo = within(bloco).getByRole('heading').textContent!
    expect(within(atrasadas()!).queryByText(titulo)).not.toBeInTheDocument()
    expect(within(await linhaDe(titulo)).getByText('· agora')).toBeInTheDocument()
  })

  test('✓ no remédio vale na tela de Remédios; tocar de novo desfaz', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/hoje')
    const tomei = within(await linhaDe('Vitamina D')).getByRole('button', { name: 'Tomei: Vitamina D' })
    await usuario.click(tomei)
    expect(tomei).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('3 de 11 feitas')).toBeInTheDocument()

    await usuario.click(tomei)
    await waitFor(() => expect(tomei).toHaveAttribute('aria-pressed', 'false'))
    expect(await screen.findByText('2 de 11 feitas')).toBeInTheDocument()

    await usuario.click(tomei)
    expect(await screen.findByText('3 de 11 feitas')).toBeInTheDocument()
    await usuario.click(screen.getAllByRole('link', { name: /Remédios|Medicamentos/ })[0])
    await esperarDoses('2 de 4 doses tomadas')
  })

  test('✓ na conta marca como paga; "Não paguei" (no ⋯) marca como não paga', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/hoje')
    const condominio = await linhaDe('Condomínio')
    await usuario.click(within(condominio).getByRole('button', { name: 'Paguei: Condomínio' }))
    await waitFor(() => expect(atrasadas()).not.toBeInTheDocument())
    const contas = await api<{ descricao: string; status: string }[]>('/pagamentos', { query: { fim: '2026-10-10' } })
    expect(contas.find((p) => p.descricao === 'Condomínio')?.status).toBe('pago')

    // Paga hoje, continua na lista (e pode ser desfeita).
    await opcao(usuario, 'Condomínio', 'Não paguei')
    expect(await within(await linhaDe('Condomínio')).findByText('· não paguei')).toBeInTheDocument()
    const depois = await api<{ descricao: string; status: string }[]>('/pagamentos', { query: { fim: '2026-10-10' } })
    expect(depois.find((p) => p.descricao === 'Condomínio')?.status).toBe('pendente')
  })

  test('se a API recusar, a marcação volta atrás', async () => {
    servidor.use(
      http.patch(`${API_URL}/hoje/:id`, () =>
        HttpResponse.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falhou.' } }, { status: 500 }),
      ),
    )
    const usuario = userEvent.setup()
    renderizarApp('/hoje')
    await opcao(usuario, 'Regar as plantas', 'Não fiz')
    expect(await screen.findByText('Falhou.')).toBeInTheDocument()
    await waitFor(async () =>
      expect(within(await linhaDe('Regar as plantas')).queryByText('· não fiz')).not.toBeInTheDocument(),
    )
  })

  test('seletor de data: outro dia, sem as contas vencidas antes nem o "Agora", e volta para hoje', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/hoje')
    await linhaDe('Condomínio')
    await usuario.click(screen.getByRole('button', { name: 'Próximo dia' }))
    expect(await screen.findByText(/^Amanhã, 14 de outubro/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Condomínio')).not.toBeInTheDocument())
    expect(screen.queryByRole('region', { name: /^(Agora|Próxima) · / })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Voltar para hoje' }))
    expect(await linhaDe('Condomínio')).toBeInTheDocument()

    // O "Ir para o dia" fica no cabeçalho, ao lado do "+ Nova", e acompanha as setas.
    const campo = screen.getByLabelText('Ir para o dia')
    expect(campo).toHaveValue('2026-10-13')
    fireEvent.change(campo, { target: { value: '2026-10-20' } })
    expect(await screen.findByText(/20 de outubro/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Dia anterior' }))
    await waitFor(() => expect(screen.getByLabelText('Ir para o dia')).toHaveValue('2026-10-19'))
  })
})

test('conta nova, sem nada: "Nada programado para hoje."', async () => {
  const { token } = await api<Sessao>('/auth/cadastro', {
    method: 'POST',
    corpo: { nome: 'Pessoa Nova', email: 'nova@exemplo.com', senha: 'senha-da-pessoa' },
  })
  salvarToken(token)
  renderizarApp('/hoje')
  expect(await screen.findByText('Nada programado para hoje.')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Nova' }).length).toBeGreaterThan(0)
})
