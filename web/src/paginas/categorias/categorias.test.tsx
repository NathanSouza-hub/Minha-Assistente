import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco, MARIA_ID } from '@/mocks/banco'
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

const nomes = () =>
  within(screen.getByRole('list', { name: 'Suas categorias' }))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('span')?.textContent)

describe('tela de categorias', () => {
  test('aparece no menu de Finanças e lista as categorias na ordem das abas', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/financas')
    const menu = await screen.findByRole('navigation', { name: 'Telas de Finanças' })
    await usuario.click(within(menu).getByRole('link', { name: 'Categorias' }))
    await screen.findByRole('list', { name: 'Suas categorias' })
    expect(nomes()).toEqual(['Contas residenciais', 'Outros'])
  })

  test('cria, renomeia e muda a ordem', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/categorias')
    await screen.findByRole('list', { name: 'Suas categorias' })

    await usuario.type(screen.getByLabelText('Nome da categoria'), 'Plano de saúde')
    await usuario.click(screen.getByRole('button', { name: 'Criar categoria' }))
    await waitFor(() => expect(nomes().at(-1)).toBe('Plano de saúde'))

    await usuario.click(screen.getByRole('button', { name: 'Renomear Plano de saúde' }))
    const campo = screen.getByLabelText('Novo nome para Plano de saúde')
    await usuario.clear(campo)
    await usuario.type(campo, 'Saúde{Enter}')
    await waitFor(() => expect(nomes().at(-1)).toBe('Saúde'))

    expect(screen.getByRole('button', { name: 'Descer Saúde' })).toBeDisabled()
    await usuario.click(screen.getByRole('button', { name: 'Subir Saúde' }))
    await waitFor(() => expect(nomes().at(-2)).toBe('Saúde'))
    expect(nomes().at(-1)).toBe('Outros')
    expect(screen.getByRole('button', { name: 'Subir Contas residenciais' })).toBeDisabled()
  })

  test('não exclui categoria com contas e exclui a vazia', async () => {
    const usuario = userEvent.setup()
    banco.categorias.push({ id: crypto.randomUUID(), usuarioId: MARIA_ID, nome: 'Vazia', ordem: 9 })
    renderizarApp('/categorias')
    await screen.findByRole('list', { name: 'Suas categorias' })

    await usuario.click(screen.getByRole('button', { name: 'Excluir Outros' }))
    await usuario.click(await screen.findByRole('button', { name: 'Excluir categoria' }))
    expect(
      await screen.findByText('Esta categoria tem contas. Mude a categoria dessas contas antes de apagar.'),
    ).toBeInTheDocument()
    expect(nomes()).toContain('Outros')

    await usuario.click(screen.getByRole('button', { name: 'Excluir Vazia' }))
    await usuario.click(await screen.findByRole('button', { name: 'Excluir categoria' }))
    await waitFor(() => expect(nomes()).not.toContain('Vazia'))
  })
})
