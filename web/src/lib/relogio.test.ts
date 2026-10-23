import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMinutoAtual } from './relogio'

let visibilidade: DocumentVisibilityState = 'visible'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-13T08:59:30-03:00'))
  visibilidade = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilidade)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useMinutoAtual', () => {
  test('avança na virada do minuto, sem recarregar', () => {
    const { result } = renderHook(() => useMinutoAtual())
    expect(result.current).toBe('08:59')
    act(() => vi.advanceTimersByTime(29_000))
    expect(result.current).toBe('08:59')
    act(() => vi.advanceTimersByTime(1_100))
    expect(result.current).toBe('09:00')
    act(() => vi.advanceTimersByTime(60_000))
    expect(result.current).toBe('09:01')
    // Um timer só por vez.
    expect(vi.getTimerCount()).toBe(1)
  })

  test('com a aba escondida não agenda nada; ao voltar, atualiza na hora', () => {
    const { result } = renderHook(() => useMinutoAtual())
    visibilidade = 'hidden'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(vi.getTimerCount()).toBe(0)
    vi.setSystemTime(new Date('2026-10-13T10:15:10-03:00'))
    visibilidade = 'visible'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe('10:15')
    expect(vi.getTimerCount()).toBe(1)
  })

  test('desligado não cria timer; desmontar limpa o timer e o ouvinte', () => {
    const remover = vi.spyOn(document, 'removeEventListener')
    renderHook(() => useMinutoAtual(false))
    expect(vi.getTimerCount()).toBe(0)
    const { unmount } = renderHook(() => useMinutoAtual())
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(remover).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
