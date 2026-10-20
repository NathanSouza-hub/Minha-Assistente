import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco } from '@/mocks/banco'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026, 08h. Tarefas de exemplo: amanhã (10h, com lembrete) e daqui a 3 dias.
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

describe('Tarefas avulsas', () => {
  test('anotar para hoje, marcar como feita e ver em "Feitas"', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/tarefas')
    expect(await screen.findByRole('region', { name: 'Próximas' })).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Nova tarefa para hoje'), 'Ler e-mails')
    await usuario.click(screen.getByRole('button', { name: 'Anotar' }))
    const hoje = await screen.findByRole('region', { name: 'Hoje' })
    expect(within(hoje).getByText('Ler e-mails')).toBeInTheDocument()

    await usuario.click(within(hoje).getByRole('button', { name: 'Marcar Ler e-mails como feita' }))
    expect(await screen.findByText('Pronto, tarefa feita.')).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Hoje' })).not.toBeInTheDocument())

    await usuario.click(screen.getByRole('radio', { name: 'Feitas' }))
    const feitas = await screen.findByRole('region', { name: 'Feitas' })
    expect(within(feitas).getByText('Ler e-mails')).toBeInTheDocument()
    expect(within(feitas).getByText(/Feita em 13\/10\/2026/)).toBeInTheDocument()
  })

  test('formulário: o lembrete só liga com hora; a tarefa aparece na tela Hoje e o ✓ de lá conclui', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/tarefas/nova')
    await usuario.type(await screen.findByLabelText('Tarefa'), 'Ligar para o contador')
    const lembrete = screen.getByRole('switch', { name: /Avisar no celular/ })
    expect(lembrete).toBeDisabled()
    await usuario.type(screen.getByLabelText('Hora (opcional)'), '11:30')
    expect(lembrete).toBeEnabled()
    await usuario.click(lembrete)
    await usuario.click(screen.getByRole('button', { name: 'Criar tarefa' }))
    await screen.findByRole('region', { name: 'Hoje' })

    const criada = banco.tarefas.find((t) => t.titulo === 'Ligar para o contador')!
    expect(criada).toMatchObject({ data: '2026-10-13', hora: '11:30', lembrete: true })
  })

  test('na tela Hoje, a tarefa do dia tem ✓/✗ e o ✓ conclui a tarefa', async () => {
    banco.tarefas.push({
      id: crypto.randomUUID(),
      usuarioId: banco.tarefas[0].usuarioId,
      titulo: 'Enviar mensagens',
      detalhes: null,
      data: '2026-10-13',
      hora: '09:15',
      lembrete: false,
      concluidaEm: null,
      criadoEm: '2026-10-13T08:00:00Z',
      atualizadoEm: '2026-10-13T08:00:00Z',
    })
    const usuario = userEvent.setup()
    renderizarApp('/hoje')
    const lista = await screen.findByRole('region', { name: 'Atividades de hoje' })
    const linha = (await within(lista).findAllByText('Enviar mensagens'))[0].closest('li')!
    await usuario.click(within(linha).getByRole('button', { name: /Fiz/ }))
    await vi.waitFor(() =>
      expect(banco.tarefas.find((t) => t.titulo === 'Enviar mensagens')!.concluidaEm).not.toBeNull(),
    )
  })
})
