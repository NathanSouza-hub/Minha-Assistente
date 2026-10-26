import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampoData, SeletorDia, SeletorMes } from './SeletorPeriodo'

// Hoje: terça, 13/10/2026 (só o Date é falso: o userEvent precisa dos timers reais).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T10:00:00-03:00'))
})
afterEach(() => vi.useRealTimers())

const janela = (nome: string) => screen.findByRole('dialog', { name: nome })

describe('SeletorMes', () => {
  test('grade de 12 meses: o escolhido marcado, anos para trás e para frente, e fecha ao escolher', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<SeletorMes mes="2026-10" aoMudar={aoMudar} />)

    await usuario.click(screen.getByRole('button', { name: 'Outubro de 2026' }))
    const grade = await janela('Escolher o mês')
    expect(within(grade).getByText('2026')).toBeInTheDocument()
    expect(within(grade).getAllByRole('button', { name: / de 2026$/ })).toHaveLength(12)
    expect(within(grade).getByRole('button', { name: 'Outubro de 2026', pressed: true })).toHaveFocus()

    await usuario.click(within(grade).getByRole('button', { name: 'Ano anterior' }))
    await usuario.click(within(grade).getByRole('button', { name: 'Ano anterior' }))
    await usuario.click(within(grade).getByRole('button', { name: 'Março de 2024' }))
    expect(aoMudar).toHaveBeenCalledWith('2024-03')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Outubro de 2026' }))
    // Reabre no ano do mês escolhido, não no último visto.
    await usuario.click(within(await janela('Escolher o mês')).getByRole('button', { name: 'Próximo ano' }))
    await usuario.click(screen.getByRole('button', { name: 'Janeiro de 2027' }))
    expect(aoMudar).toHaveBeenLastCalledWith('2027-01')
  })

  test('"Este mês" volta ao mês atual; escolher o mesmo mês não chama aoMudar', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<SeletorMes mes="2025-02" aoMudar={aoMudar} />)
    await usuario.click(screen.getByRole('button', { name: 'Fevereiro de 2025' }))
    await usuario.click(within(await janela('Escolher o mês')).getByRole('button', { name: 'Fevereiro de 2025' }))
    expect(aoMudar).not.toHaveBeenCalled()

    await usuario.click(screen.getByRole('button', { name: 'Fevereiro de 2025' }))
    await usuario.click(within(await janela('Escolher o mês')).getByRole('button', { name: 'Este mês' }))
    expect(aoMudar).toHaveBeenCalledWith('2026-10')
  })

  test('limites desativam meses e anos fora deles', async () => {
    const usuario = userEvent.setup()
    render(<SeletorMes mes="2026-10" aoMudar={vi.fn()} min="2026-03" max="2026-11" />)
    await usuario.click(screen.getByRole('button', { name: 'Outubro de 2026' }))
    const grade = await janela('Escolher o mês')
    expect(within(grade).getByRole('button', { name: 'Fevereiro de 2026' })).toBeDisabled()
    expect(within(grade).getByRole('button', { name: 'Março de 2026' })).toBeEnabled()
    expect(within(grade).getByRole('button', { name: 'Dezembro de 2026' })).toBeDisabled()
    expect(within(grade).getByRole('button', { name: 'Ano anterior' })).toBeDisabled()
    expect(within(grade).getByRole('button', { name: 'Próximo ano' })).toBeDisabled()
  })

  test('setas do teclado andam pela grade (3 colunas)', async () => {
    const usuario = userEvent.setup()
    render(<SeletorMes mes="2026-05" aoMudar={vi.fn()} />)
    await usuario.click(screen.getByRole('button', { name: 'Maio de 2026' }))
    await janela('Escolher o mês')
    await usuario.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Junho de 2026' })).toHaveFocus()
    await usuario.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Setembro de 2026' })).toHaveFocus()
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('SeletorDia', () => {
  test('calendário do mês; o nome do mês abre a grade de meses para pular longe', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<SeletorDia data="2026-10-13" aoMudar={aoMudar} texto="Hoje, 13 de outubro" />)

    await usuario.click(screen.getByRole('button', { name: 'Hoje, 13 de outubro' }))
    const calendario = await janela('Escolher o dia')
    expect(within(calendario).getByRole('button', { name: 'Terça-feira, 13 de outubro', pressed: true })).toHaveFocus()

    await usuario.click(within(calendario).getByRole('button', { name: 'Outubro de 2026: escolher mês e ano' }))
    await usuario.click(within(calendario).getByRole('button', { name: 'Próximo ano' }))
    await usuario.click(within(calendario).getByRole('button', { name: 'Fevereiro de 2027' }))
    // De volta aos dias, já no mês escolhido.
    await usuario.click(within(calendario).getByRole('button', { name: 'Domingo, 28 de fevereiro' }))
    expect(aoMudar).toHaveBeenCalledWith('2027-02-28')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('setas de mês e "Hoje"', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<SeletorDia data="2026-01-31" aoMudar={aoMudar} />)
    await usuario.click(screen.getByRole('button', { name: 'Sábado, 31 de janeiro' }))
    const calendario = await janela('Escolher o dia')
    await usuario.click(within(calendario).getByRole('button', { name: 'Mês anterior' }))
    expect(within(calendario).getByRole('group', { name: 'Dezembro de 2025' })).toBeInTheDocument()
    await usuario.click(within(calendario).getByRole('button', { name: 'Hoje' }))
    expect(aoMudar).toHaveBeenCalledWith('2026-10-13')
  })
})

test('CampoData: data curta no campo, limite mínimo e erro ligado ao campo', async () => {
  const usuario = userEvent.setup()
  render(<CampoData rotulo="Até" data="2026-10-20" min="2026-10-15" aoMudar={vi.fn()} erro="Data inválida." />)
  const campo = screen.getByRole('button', { name: 'Até' })
  expect(campo).toHaveTextContent('20/10/2026')
  expect(campo).toHaveAccessibleDescription('Data inválida.')
  await usuario.click(campo)
  const calendario = await janela('Até')
  expect(within(calendario).getByRole('button', { name: /14 de outubro/ })).toBeDisabled()
  expect(within(calendario).getByRole('button', { name: /15 de outubro/ })).toBeEnabled()
  expect(within(calendario).getByRole('button', { name: 'Mês anterior' })).toBeDisabled()
})
