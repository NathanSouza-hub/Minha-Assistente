import { describe, expect, test } from 'vitest'
import { deMinutos, descreverMinutos, minutosVespera, paraMinutos, VESPERA } from './lembretes'

describe('lembretes', () => {
  test('véspera às 18h depende do horário do evento', () => {
    expect(minutosVespera('2026-10-20', '12:00')).toBe(1080) // 18h antes
    expect(minutosVespera('2026-10-20', '07:30')).toBe(810)
    expect(minutosVespera('2026-10-20', '18:00')).toBe(1440)
  })

  test('converte escolhas em minutos sem repetir e na ordem da API', () => {
    expect(paraMinutos([120, VESPERA], '2026-10-20', '12:00')).toEqual([1080, 120])
    // Evento às 18h: véspera às 18h = 1 dia antes → um lembrete só
    expect(paraMinutos([VESPERA, 1440], '2026-10-20', '18:00')).toEqual([1440])
  })

  test('reconhece a véspera ao editar e mantém valores fora dos atalhos', () => {
    expect(deMinutos([1080, 45], '2026-10-20', '12:00')).toEqual([VESPERA, 45])
  })

  test('descreve minutos fora dos atalhos', () => {
    expect(descreverMinutos(45)).toBe('45 minutos antes')
    expect(descreverMinutos(180)).toBe('3 horas antes')
    expect(descreverMinutos(2880)).toBe('2 dias antes')
  })
})
