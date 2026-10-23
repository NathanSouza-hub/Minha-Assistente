import { describe, expect, test } from 'vitest'
import { periodoAnterior, somarDias, trechosComparaveis } from '@/lib/datas'
import { VERSOS, versoDoDia } from '@/lib/versos'

describe('Verso do dia', () => {
  test('nunca repete em dias seguidos e passa por todos antes de repetir', () => {
    const vistos = new Set<string>()
    let anterior = ''
    for (let i = 0; i < VERSOS.length; i++) {
      const verso = versoDoDia(somarDias('2026-10-22', i))
      expect(verso.referencia).not.toBe(anterior)
      anterior = verso.referencia
      vistos.add(verso.referencia)
    }
    expect(vistos.size).toBe(VERSOS.length)
  })

  test('cada verso tem referência, texto completo e o código do livro para buscar o capítulo', () => {
    for (const v of VERSOS) {
      expect(v.referencia).toMatch(/^[1-3]? ?\p{L}+ \d+:\d+(-\d+)?$/u)
      expect(v.texto).toMatch(/^\p{Lu}.*[.?!]$/u)
      expect(v.livro).toMatch(/^[1-3A-Z]{3}$/)
    }
  })
})

describe('período anterior (comparação do relatório)', () => {
  test('mês inteiro compara com o mês inteiro anterior', () => {
    expect(periodoAnterior({ inicio: '2026-10-01', fim: '2026-10-31' })).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' })
    expect(periodoAnterior({ inicio: '2026-01-01', fim: '2026-12-31' })).toEqual({ inicio: '2025-01-01', fim: '2025-12-31' })
  })
  test('datas soltas comparam com o mesmo número de dias antes', () => {
    expect(periodoAnterior({ inicio: '2026-10-05', fim: '2026-10-14' })).toEqual({ inicio: '2026-09-25', fim: '2026-10-04' })
  })
})

describe('trechos comparáveis (período em andamento)', () => {
  test('período que ainda não terminou compara do início até hoje com o mesmo trecho do anterior', () => {
    expect(trechosComparaveis({ inicio: '2026-10-01', fim: '2026-10-31' }, '2026-10-22')).toEqual({
      atual: { inicio: '2026-10-01', fim: '2026-10-22' },
      anterior: { inicio: '2026-09-01', fim: '2026-09-22' },
      parcial: true,
    })
  })
  test('o trecho anterior não passa do fim do período anterior (31 de março × fevereiro)', () => {
    expect(trechosComparaveis({ inicio: '2026-03-01', fim: '2026-03-31' }, '2026-03-31')).toEqual({
      atual: { inicio: '2026-03-01', fim: '2026-03-31' },
      anterior: { inicio: '2026-02-01', fim: '2026-02-28' },
      parcial: false,
    })
    expect(trechosComparaveis({ inicio: '2026-03-01', fim: '2026-03-31' }, '2026-03-30')?.anterior).toEqual({
      inicio: '2026-02-01',
      fim: '2026-02-28',
    })
  })
  test('período encerrado compara inteiro; período futuro não compara', () => {
    expect(trechosComparaveis({ inicio: '2026-09-01', fim: '2026-09-30' }, '2026-10-22')?.parcial).toBe(false)
    expect(trechosComparaveis({ inicio: '2026-11-01', fim: '2026-11-30' }, '2026-10-22')).toBeNull()
  })
})
