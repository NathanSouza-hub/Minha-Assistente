import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { API_URL } from '@/lib/api'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco, MARIA_ID } from '@/mocks/banco'
import { vincularNoMock } from '@/mocks/whatsapp'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'
import { formatarTelefone } from '@/lib/telefone'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  resetarBancoMock()
  await entrarComoMaria()
})
afterEach(() => {
  servidor.resetHandlers()
  localStorage.clear()
})
afterAll(() => servidor.close())

describe('tela WhatsApp', () => {
  test('gera o código, mostra o link do WhatsApp e percebe sozinha quando o número é ligado', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/whatsapp')
    expect(await screen.findByRole('heading', { name: 'Ligar o seu WhatsApp' })).toBeInTheDocument()
    expect(screen.getByText('+55 11 99999-0000')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Gerar código' }))
    expect(await screen.findByRole('heading', { name: 'Mande este código pelo WhatsApp' })).toBeInTheDocument()
    const { codigo } = banco.whatsapp.get(MARIA_ID)!
    expect(screen.getByText(codigo!)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir o WhatsApp' })).toHaveAttribute(
      'href',
      `https://wa.me/5511999990000?text=${codigo}`,
    )

    // A pessoa manda o código pelo WhatsApp: a tela relê sozinha e passa para "ligado".
    vincularNoMock(codigo!, '5511987654321')
    expect(await screen.findByRole('heading', { name: 'WhatsApp ligado' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/Número •••• 4321/)).toBeInTheDocument()
    expect(screen.getByText('Pronto! Seu WhatsApp está ligado à sua conta.')).toBeInTheDocument()
  })

  test('desligar pede confirmação e volta para o passo a passo', async () => {
    banco.whatsapp.set(MARIA_ID, { telefone: '5511987654321', vinculadoEm: '2026-10-26T13:00:00Z', codigo: null, expiraEm: null })
    const usuario = userEvent.setup()
    renderizarApp('/whatsapp')
    expect(await screen.findByRole('heading', { name: 'WhatsApp ligado' })).toBeInTheDocument()
    expect(screen.getByText(/ligado em 26\/10\/2026/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Desligar' }))
    const dialogo = await screen.findByRole('alertdialog')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desligar WhatsApp' }))
    expect(await screen.findByRole('heading', { name: 'Ligar o seu WhatsApp' })).toBeInTheDocument()
    expect(banco.whatsapp.get(MARIA_ID)?.telefone).toBeNull()
  })

  test('com o número ligado, envia um lembrete de teste', async () => {
    banco.whatsapp.set(MARIA_ID, { telefone: '5511987654321', vinculadoEm: '2026-10-26T13:00:00Z', codigo: null, expiraEm: null })
    const usuario = userEvent.setup()
    renderizarApp('/whatsapp')
    expect(await screen.findByText(/Os lembretes chegam por lá também/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mande mensagens como' })).toBeInTheDocument()
    expect(screen.getByText('“almoço 45,90”')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Enviar lembrete de teste' }))
    expect(await screen.findByText('Lembrete de teste enviado.')).toBeInTheDocument()
  })

  test('cancelar o código volta sem ligar nada', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/whatsapp')
    await usuario.click(await screen.findByRole('button', { name: 'Gerar código' }))
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('heading', { name: 'Ligar o seu WhatsApp' })).toBeInTheDocument()
  })

  test('servidor sem as chaves mostra que ainda não está disponível', async () => {
    servidor.use(
      http.get(`${API_URL}/whatsapp`, () =>
        HttpResponse.json({ disponivel: false, assistente: false, numero: null, vinculado: false, telefone: null, vinculadoEm: null }),
      ),
    )
    renderizarApp('/whatsapp')
    expect(await screen.findByRole('heading', { name: 'Ainda não disponível' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gerar código' })).not.toBeInTheDocument()
  })

  test('aparece no menu de Configurações', async () => {
    renderizarApp('/whatsapp')
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: 'WhatsApp' }).some((l) => l.getAttribute('aria-current') === 'page')).toBe(true),
    )
  })
})

test('formata o número do app', () => {
  expect(formatarTelefone('5511999990000')).toBe('+55 11 99999-0000')
  expect(formatarTelefone('551133334444')).toBe('+55 11 3333-4444')
  expect(formatarTelefone('14155550100')).toBe('+14155550100')
})
