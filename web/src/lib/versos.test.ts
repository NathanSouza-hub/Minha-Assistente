import { describe, expect, test } from 'vitest'
import { periodoAnterior, somarDias } from '@/lib/datas'
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
