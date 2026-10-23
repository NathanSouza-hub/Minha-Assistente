import { expect, test } from 'vitest'
import { escalaInteira } from './grafico'

test('escala de contagens: marcas inteiras, começando no zero, sem teto', () => {
  expect(escalaInteira(0)).toEqual({ topo: 1, passos: [0, 1] })
  expect(escalaInteira(3)).toEqual({ topo: 3, passos: [0, 1, 2, 3] })
  expect(escalaInteira(5)).toEqual({ topo: 6, passos: [0, 2, 4, 6] })
  expect(escalaInteira(37)).toEqual({ topo: 40, passos: [0, 10, 20, 30, 40] })
  // Valores altos (antes passavam do fim da lista de passos e viravam NaN).
  const grande = escalaInteira(25_000)
  expect(grande.topo).toBeGreaterThanOrEqual(25_000)
  expect(grande.passos.every(Number.isInteger)).toBe(true)
  expect(grande.passos.length).toBeLessThanOrEqual(5)
})
