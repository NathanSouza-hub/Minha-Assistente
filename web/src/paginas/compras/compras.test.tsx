import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco } from '@/mocks/banco'
import { API_URL } from '@/lib/api'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'
import { descreverCompra, sugerirCategorias } from './formulario'

const servidor = setupServer(...handlers)

const idDe = (nome: string) => banco.compras.find((i) => i.nome === nome)!.id

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026. Pendentes: Leite e Arroz (Mercado), Bananas (Feira), Protetor solar
  // (Farmácia), Pilhas AA (sem categoria). Pão de forma comprado ontem.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T10:00:00-03:00'))
  resetarBancoMock()
  await entrarComoMaria()
})
afterEach(() => {
  servidor.resetHandlers()
  localStorage.clear()
  vi.useRealTimers()
})
afterAll(() => servidor.close())

const nomesEm = (lista: HTMLElement) =>
  within(lista)
    .getAllByRole('checkbox')
    .map((c) => c.textContent)

describe('lista', () => {
  test('pendentes por categoria (sem categoria no fim) e comprados depois', async () => {
    renderizarApp('/compras')
    expect(await screen.findByText('1 de 6 itens comprados')).toBeInTheDocument()
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Farmácia', 'Feira', 'Mercado', 'Sem categoria'])
    expect(nomesEm(screen.getByRole('list', { name: 'Mercado' }))).toEqual(['Arroz5 kg', 'Leite integral6 caixas'])
    const comprados = screen.getByRole('list', { name: 'Já comprados' })
    expect(within(comprados).getByRole('checkbox', { name: /Pão de forma/ })).toHaveAttribute('aria-checked', 'true')
    expect(within(comprados).getByText('Comprado ontem')).toBeInTheDocument()
  })

  test('mesma categoria escrita de outro jeito fica no mesmo grupo', async () => {
    banco.compras.find((i) => i.nome === 'Leite integral')!.categoria = 'mercado'
    renderizarApp('/compras')
    const mercado = await screen.findByRole('list', { name: 'Mercado' })
    expect(nomesEm(mercado)).toEqual(['Arroz5 kg', 'Leite integral6 caixas'])
  })

  test('lista vazia', async () => {
    banco.compras.length = 0
    renderizarApp('/compras')
    expect(await screen.findByText('A lista está vazia')).toBeInTheDocument()
  })
})

describe('marcar', () => {
  test('tocar no item manda para os comprados e tocar de novo traz de volta', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/compras')
    await usuario.click(await screen.findByRole('checkbox', { name: /Arroz/ }))
    expect(await screen.findByText('2 de 6 itens comprados')).toBeInTheDocument()
    const comprados = screen.getByRole('list', { name: 'Já comprados' })
    // O mais recente primeiro.
    expect(nomesEm(comprados)[0]).toBe('ArrozComprado às 10:00')
    expect(banco.compras.find((i) => i.nome === 'Arroz')?.comprado).toBe(true)

    await usuario.click(within(comprados).getByRole('checkbox', { name: /Arroz/ }))
    expect(await screen.findByText('1 de 6 itens comprados')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Mercado' })).getByRole('checkbox', { name: /Arroz/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  test('erro do servidor desfaz a marcação', async () => {
    servidor.use(
      http.patch(`${API_URL}/compras/:id/comprado`, () =>
        HttpResponse.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro inesperado no servidor.' } }, { status: 500 }),
      ),
    )
    const usuario = userEvent.setup()
    renderizarApp('/compras')
    await usuario.click(await screen.findByRole('checkbox', { name: /Bananas/ }))
    expect(await screen.findByText('Erro inesperado no servidor.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Bananas/ })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('1 de 6 itens comprados')).toBeInTheDocument()
  })

  test('limpar comprados tira da lista depois de confirmar', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/compras')
    await usuario.click(await screen.findByRole('button', { name: 'Limpar comprados' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Tirar o item comprado da lista?')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Limpar comprados' }))
    expect(await screen.findByText('Item comprado tirado da lista.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Já comprados' })).not.toBeInTheDocument()
    expect(banco.compras.map((i) => i.nome)).not.toContain('Pão de forma')
  })
})

describe('adicionar e editar', () => {
  test('adiciona mantendo a categoria para o próximo item', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/compras')
    const nome = await screen.findByLabelText('O que falta comprar?')
    await usuario.type(nome, 'Café')
    await usuario.type(screen.getByLabelText('Quantidade'), '2 pacotes')
    await usuario.type(screen.getByLabelText('Categoria'), 'Mercado')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar à lista' }))

    expect(await screen.findByText('Café adicionado à lista.')).toBeInTheDocument()
    expect(nomesEm(screen.getByRole('list', { name: 'Mercado' }))).toContain('Café2 pacotes')
    expect(nome).toHaveValue('')
    expect(nome).toHaveFocus()
    expect(screen.getByLabelText('Quantidade')).toHaveValue('')
    expect(screen.getByLabelText('Categoria')).toHaveValue('Mercado')

    // Enter também adiciona.
    await usuario.type(nome, 'Açúcar{Enter}')
    expect(await screen.findByText('Açúcar adicionado à lista.')).toBeInTheDocument()
    expect(nomesEm(screen.getByRole('list', { name: 'Mercado' }))).toContain('Açúcar')
  })

  test('sem nome não envia', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/compras')
    await usuario.click(await screen.findByRole('button', { name: 'Adicionar à lista' }))
    expect(await screen.findByText('Informe o item.')).toBeInTheDocument()
    expect(banco.compras).toHaveLength(6)
  })

  test('edita sem mudar o status e volta para a lista', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/compras')
    await usuario.click(await screen.findByRole('link', { name: 'Editar Pão de forma' }))
    const nome = await screen.findByLabelText('Item')
    await usuario.clear(nome)
    await usuario.type(nome, 'Pão integral')
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Item salvo.')).toBeInTheDocument()
    const comprados = await screen.findByRole('list', { name: 'Já comprados' })
    expect(within(comprados).getByRole('checkbox', { name: /Pão integral/ })).toHaveAttribute('aria-checked', 'true')
  })

  test('tira da lista pela edição', async () => {
    const usuario = userEvent.setup()
    renderizarApp(`/compras/${idDe('Pilhas AA')}`)
    await usuario.click(await screen.findByRole('button', { name: 'Tirar da lista' }))
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Tirar da lista' }))
    expect(await screen.findByText('Pilhas AA tirado da lista.')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Pilhas AA/ })).not.toBeInTheDocument()
  })

  test('item que não existe', async () => {
    renderizarApp('/compras/00000000-0000-4000-8000-000000000000')
    expect(await screen.findByText('Este item não existe mais ou foi tirado da lista.')).toBeInTheDocument()
  })
})

test('sugestões de categoria sem repetir', () => {
  const item = (categoria: string | null) => ({ categoria }) as Parameters<typeof sugerirCategorias>[0][number]
  expect(sugerirCategorias([item('mercado'), item('Pet shop'), item(null), item('farmacia')])).toEqual([
    'Açougue',
    'Casa',
    'farmacia',
    'Feira',
    'mercado',
    'Padaria',
    'Pet shop',
  ])
})

test('descreverCompra', () => {
  expect(descreverCompra('2026-10-13T08:15:00-03:00')).toBe('Comprado às 08:15')
  expect(descreverCompra('2026-10-12T20:00:00-03:00')).toBe('Comprado ontem')
  expect(descreverCompra('2026-10-01T20:00:00-03:00')).toBe('Comprado em 01/10')
})
