import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco } from '@/mocks/banco'
import { lerToken } from '@/lib/sessao'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'

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

describe('trocar senha', () => {
  test('confere a senha atual e a repetição antes de trocar', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/mais')
    await usuario.click(within(await screen.findByRole('main')).getByRole('link', { name: 'Trocar senha' }))

    await usuario.type(await screen.findByLabelText('Senha atual'), 'nao-e-essa')
    await usuario.type(screen.getByLabelText('Nova senha'), 'senha-nova-forte')
    await usuario.type(screen.getByLabelText('Repita a nova senha'), 'senha-nova-fort')
    await usuario.click(screen.getByRole('button', { name: 'Trocar senha' }))
    expect(await screen.findByText('As duas senhas novas não são iguais.')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Repita a nova senha'), 'e')
    await usuario.click(screen.getByRole('button', { name: 'Trocar senha' }))
    expect(await screen.findByText('A senha atual não confere.')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha atual')).toHaveAttribute('aria-invalid', 'true')
  })

  test('troca, continua conectado com o token novo e volta para Mais', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/conta/senha')
    await usuario.type(await screen.findByLabelText('Senha atual'), 'uma-senha-forte')
    await usuario.type(screen.getByLabelText('Nova senha'), 'senha-nova-forte')
    await usuario.type(screen.getByLabelText('Repita a nova senha'), 'senha-nova-forte')
    await usuario.click(screen.getByRole('button', { name: 'Trocar senha' }))

    expect(await screen.findByText('Senha trocada. Os outros aparelhos precisam entrar de novo.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Mais', level: 1 })).toBeInTheDocument()
    expect(banco.usuarios.get('maria@exemplo.com')?.senha).toBe('senha-nova-forte')
    expect(lerToken()).not.toBeNull()
  })
})
