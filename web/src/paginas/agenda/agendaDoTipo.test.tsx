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

    // O formulário do rádio: sem o campo "Tipo", com "Nome do programa" e "Emissora".
    expect(await screen.findByRole('heading', { name: 'Novo programa de rádio' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument()
    expect((await principal()).getByRole('link', { name: 'Programa de rádio' })).toHaveAttribute('href', '/radio')
    await usuario.type(screen.getByLabelText('Nome do programa'), 'Programa ao vivo')
    await usuario.type(screen.getByLabelText('Emissora (opcional)'), 'Rádio Cidade')
    await usuario.type(screen.getByLabelText('Começa às'), '10:00')
    await usuario.click(screen.getByRole('button', { name: 'Agendar' }))

    expect(await screen.findByText('Agendamento marcado.')).toBeInTheDocument()
    expect(await (await principal()).findByText('Programa ao vivo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Programa de rádio', level: 1 })).toBeInTheDocument()
  })

  test('Viagens e Rádio saíram do menu da Agenda; Medicamentos não tem fileira de telas', async () => {
    renderizarApp('/agenda')
    await screen.findByRole('heading', { name: 'Agenda', level: 1 })
    // Só "Agendamentos": a fileira de telas some (viagens e rádio nascem no "+ Novo").
    expect(screen.queryByRole('navigation', { name: 'Telas de Agenda' })).not.toBeInTheDocument()
    cleanup()
    // Consultas, exames, fisioterapia e atividade física continuam (rotas e dados), mas saíram do menu:
    // Medicamentos é uma tela só, sem a fileira de telas.
    renderizarApp('/remedios')
    await screen.findByRole('heading', { level: 1, name: 'Medicamentos' })
    expect(screen.queryByRole('navigation', { name: 'Telas de Medicamentos' })).not.toBeInTheDocument()
  })
})

describe('modalidade de acordo com o tipo', () => {
  const opcoes = (campo: HTMLElement) =>
    within(campo).getAllByRole('option').map((o) => o.textContent)

  test('consulta: presencial ou telemedicina; podcast: presencial ou videoconferência', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/agenda/novo?tipo=consulta')
    expect(opcoes(await screen.findByLabelText('Como vai ser? (opcional)'))).toEqual([
      'Não informar',
      'Presencial',
      'Telemedicina',
    ])

    cleanup()
    renderizarApp('/agenda/novo')
    const tipo = await screen.findByLabelText('Tipo')
    expect(screen.queryByLabelText('Como vai ser? (opcional)')).not.toBeInTheDocument()
    await usuario.selectOptions(tipo, 'Podcast')
    expect(opcoes(screen.getByLabelText('Como vai ser? (opcional)'))).toEqual([
      'Não informar',
      'Presencial',
      'Videoconferência',
    ])
    // Videoconferência é sempre online: sem a escolha.
    await usuario.selectOptions(tipo, 'Videoconferência')
    expect(screen.queryByLabelText('Como vai ser? (opcional)')).not.toBeInTheDocument()

    cleanup()
    renderizarApp('/agenda/novo?tipo=atividade_fisica')
    await screen.findByLabelText('Tipo de atividade')
    expect(screen.queryByLabelText('Como vai ser? (opcional)')).not.toBeInTheDocument()
  })
})
