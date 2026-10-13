import { describe, expect, test } from 'vitest'
import {
  dataCurta,
  dataPorExtenso,
  deDataISO,
  descreverVencimento,
  horaDe,
  intervaloDoMes,
  nomeDoMes,
  paraDataHoraISO,
  somarMeses,
} from './datas'

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

describe('meses', () => {
  test('intervalo do mês considera o último dia certo', () => {
    expect(intervaloDoMes('2026-02')).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' })
    expect(intervaloDoMes('2028-02')).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' })
    expect(intervaloDoMes('2026-10')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
  })

  test('soma meses atravessando o ano e dá nome ao mês', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01')
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
    expect(nomeDoMes('2026-10')).toBe('Outubro de 2026')
  })
})

describe('descreverVencimento', () => {
  test.each([
    ['2026-10-10', 'Venceu há 3 dias'],
    ['2026-10-12', 'Venceu ontem'],
    ['2026-10-13', 'Vence hoje'],
    ['2026-10-14', 'Vence amanhã'],
    ['2026-10-20', 'Vence em 7 dias'],
    ['2026-10-25', 'Vence 25/10'],
  ])('%s → %s', (vencimento, esperado) => {
    expect(descreverVencimento(vencimento, '2026-10-13')).toBe(esperado)
  })
})
