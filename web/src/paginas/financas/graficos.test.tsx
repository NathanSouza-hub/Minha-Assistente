import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GraficoCategorias } from './graficos'

const itens = Array.from({ length: 11 }, (_, i) => ({ nome: `Categoria ${i + 1}`, total: (i + 1) * 1000, pago: 0 }))

test('muitas categorias: as 8 maiores primeiro, as outras num toque, e o percentual sobre o total da API', async () => {
  const usuario = userEvent.setup()
  // Total da API maior que a soma das barras (ex.: categoria com valor zero fora da lista).
  render(<GraficoCategorias itens={[...itens, { nome: 'Vazia', total: 0, pago: 0 }]} total={132_000} />)
  expect(screen.getAllByRole('listitem')).toHaveLength(8)
  expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Categoria 11')
  expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('8%')
  expect(screen.queryByText('Vazia')).not.toBeInTheDocument()

  const botao = screen.getByRole('button', { name: 'Ver todas as 11 categorias' })
  await usuario.click(botao)
  expect(screen.getAllByRole('listitem')).toHaveLength(11)
  expect(botao).toHaveAttribute('aria-expanded', 'true')
  expect(botao).toHaveTextContent('Mostrar só as maiores')
})
