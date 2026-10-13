import { describe, expect, test } from 'vitest'
import { formatarCentavos, paraCentavos } from './dinheiro'

describe('formatarCentavos', () => {
  test('formata em reais com vírgula decimal', () => {
    expect(formatarCentavos(15990)).toBe('R$\u00a0159,90')
    expect(formatarCentavos(123456789)).toBe('R$\u00a01.234.567,89')
    expect(formatarCentavos(5)).toBe('R$\u00a00,05')
  })
})

describe('paraCentavos', () => {
  test.each([
    ['159,90', 15990],
    ['R$ 159,90', 15990],
    ['1.234,5', 123450],
    ['1234', 123400],
    ['0,99', 99],
    ['0,29', 29],
    ['  12,3 ', 1230],
  ])('%s → %i', (texto, esperado) => {
    expect(paraCentavos(texto)).toBe(esperado)
  })

  test.each(['', 'abc', '1,234', '12.34', '1.23,00', '-5'])('rejeita "%s"', (texto) => {
    expect(paraCentavos(texto)).toBeNull()
  })
})
