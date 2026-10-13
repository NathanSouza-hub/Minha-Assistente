import { describe, expect, test } from 'vitest'
import { dataCurta, dataPorExtenso, deDataISO, horaDe, paraDataHoraISO } from './datas'

describe('datas sem hora', () => {
  test('não desloca o dia no fuso do Brasil', () => {
    expect(deDataISO('2026-10-13').day).toBe(13)
    expect(dataCurta('2026-10-13')).toBe('13/10/2026')
    expect(dataCurta('2026-01-01')).toBe('01/01/2026')
  })

  test('escreve a data por extenso em português', () => {
    expect(dataPorExtenso('2026-10-13')).toBe('Terça-feira, 13 de outubro')
  })
})

describe('data e hora', () => {
  test('mostra a hora de São Paulo mesmo se a API mandar outro offset', () => {
    expect(horaDe('2026-10-13T14:00:00-03:00')).toBe('14:00')
    expect(horaDe('2026-10-13T17:00:00Z')).toBe('14:00')
  })

  test('gera ISO com offset e sem milissegundos', () => {
    expect(paraDataHoraISO(deDataISO('2026-10-13').set({ hour: 8, millisecond: 450 }))).toBe(
      '2026-10-13T08:00:00-03:00',
    )
  })
})
