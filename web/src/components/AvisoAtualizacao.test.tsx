import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acompanharFormularios } from '@/lib/formularios'
import { AvisoAtualizacao } from './AvisoAtualizacao'

// O registro do service worker é simulado: só interessa se há versão nova e o que o aviso faz.
const sw = vi.hoisted(() => ({ temVersaoNova: true, updateServiceWorker: vi.fn(async () => {}) }))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: useState(sw.temVersaoNova),
    offlineReady: useState(false),
    updateServiceWorker: sw.updateServiceWorker,
  }),
}))

let parar: () => void

beforeEach(() => {
  sw.temVersaoNova = true
  sw.updateServiceWorker.mockClear()
  parar = acompanharFormularios()
})

afterEach(() => parar())

describe('AvisoAtualizacao', () => {
  it('não aparece sem versão nova', () => {
    sw.temVersaoNova = false
    render(<AvisoAtualizacao />)
    expect(screen.queryByRole('status', { name: 'Nova versão do app' })).not.toBeInTheDocument()
  })

  it('avisa da versão nova e atualiza ao tocar em Atualizar', async () => {
    render(<AvisoAtualizacao />)
    expect(screen.getByText('Nova versão do app disponível')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('"Depois" fecha o aviso sem atualizar', async () => {
    render(<AvisoAtualizacao />)
    await userEvent.click(screen.getByRole('button', { name: 'Depois' }))
    expect(screen.queryByText('Nova versão do app disponível')).not.toBeInTheDocument()
    expect(sw.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('com formulário preenchido, pergunta antes e deixa continuar preenchendo', async () => {
    render(
      <>
        <form>
          <label>
            Título <input />
          </label>
        </form>
        <AvisoAtualizacao />
      </>,
    )
    await userEvent.type(screen.getByLabelText('Título'), 'Dentista')
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    expect(await screen.findByRole('alertdialog', { name: 'Atualizar agora?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar preenchendo' }))
    expect(sw.updateServiceWorker).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Título')).toHaveValue('Dentista')

    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Atualizar mesmo assim' }))
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true)
  })
})
