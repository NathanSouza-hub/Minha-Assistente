import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
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

const principal = async () => within(await screen.findByRole('main'))

describe('áreas por tipo (Programa de rádio, Atividade física, Fisioterapia)', () => {
  test('mostra só os agendamentos do tipo, nos próximos dias', async () => {
    renderizarApp('/fisioterapia')
    const main = await principal()
    expect(await main.findByRole('heading', { name: 'Fisioterapia', level: 1 })).toBeInTheDocument()
    // Série semanal: hoje (13/10) e as próximas terças
    // (mais o link "Fisioterapia" do menu da Saúde, que aparece antes de a agenda carregar)
    await waitFor(() => expect(main.getAllByRole('link', { name: /Fisioterapia/ }).length).toBeGreaterThanOrEqual(9))
    expect(main.queryByText('Consulta com cardiologista')).not.toBeInTheDocument()
    expect(main.queryByText('Caminhada no parque')).not.toBeInTheDocument()
  })

  test('"Novo" já vem com o tipo e salvar volta para a área', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/radio')
    const main = await principal()
    expect(await main.findByText('Gravação do programa')).toBeInTheDocument()
    await usuario.click(main.getByRole('link', { name: 'Novo' }))

    expect(await screen.findByLabelText('Tipo')).toHaveDisplayValue('Programa de rádio')
    expect((await principal()).getByRole('link', { name: 'Programa de rádio' })).toHaveAttribute('href', '/radio')
    await usuario.type(screen.getByLabelText('O que é?'), 'Programa ao vivo')
    await usuario.type(screen.getByLabelText('Começa às'), '10:00')
    await usuario.click(screen.getByRole('button', { name: 'Agendar' }))

    expect(await screen.findByText('Agendamento marcado.')).toBeInTheDocument()
    expect(await (await principal()).findByText('Programa ao vivo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Programa de rádio', level: 1 })).toBeInTheDocument()
  })

  test('Rádio fica no menu da Agenda; Fisioterapia, Consultas e Exames no menu da Saúde', async () => {
    renderizarApp('/agenda')
    const agenda = await screen.findByRole('navigation', { name: 'Telas de Agenda' })
    expect(within(agenda).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Agendamentos',
      'Viagens',
      'Programa de rádio',
    ])
    cleanup()
    renderizarApp('/remedios')
    const saude = await screen.findByRole('navigation', { name: 'Telas de Saúde' })
    expect(within(saude).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Medicamentos',
      'Consultas',
      'Exames',
      'Fisioterapia',
      'Atividade física',
    ])
  })
})

describe('modalidade de acordo com o tipo', () => {
  const opcoes = (campo: HTMLElement) =>
    within(campo).getAllByRole('option').map((o) => o.textContent)

  test('consulta: presencial ou telemedicina; vídeo: videoconferência, podcast ou gravação', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/agenda/novo')
    const tipo = await screen.findByLabelText('Tipo')
    expect(screen.queryByLabelText('Como vai ser? (opcional)')).not.toBeInTheDocument()

    await usuario.selectOptions(tipo, 'Consulta')
    expect(opcoes(screen.getByLabelText('Como vai ser? (opcional)'))).toEqual([
      'Não informar',
      'Presencial',
      'Telemedicina',
    ])
    await usuario.selectOptions(screen.getByLabelText('Como vai ser? (opcional)'), 'Telemedicina')

    // Trocar para um tipo em que a escolha não vale apaga a modalidade
    await usuario.selectOptions(tipo, 'Vídeo')
    const modalidade = screen.getByLabelText('Como vai ser? (opcional)')
    expect(opcoes(modalidade)).toEqual(['Não informar', 'Videoconferência', 'Podcast', 'Gravação'])
    expect(modalidade).toHaveDisplayValue('Não informar')

    await usuario.selectOptions(tipo, 'Atividade física')
    expect(screen.queryByLabelText('Como vai ser? (opcional)')).not.toBeInTheDocument()
  })
})
