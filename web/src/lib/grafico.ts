import { useCallback, useState } from 'react'

/** Limite "redondo" do eixo e os 4 intervalos entre 0 e ele (em centavos). */
export function escala(maximo: number) {
  if (maximo <= 0) return { topo: 100_00, passos: [0, 25_00, 50_00, 75_00, 100_00] }
  const bruto = maximo / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)!
  return { topo: passo * 4, passos: [0, 1, 2, 3, 4].map((i) => i * passo) }
}

/**
 * Escala para contagens: passo inteiro "redondo" (1, 2, 5, 10, 20, 50...) para no máximo 4
 * intervalos, começando no zero. Sem teto: a potência de 10 vem do próprio máximo.
 */
export function escalaInteira(maximo: number) {
  if (maximo <= 4) {
    const topo = Math.max(Math.ceil(maximo), 1)
    return { topo, passos: Array.from({ length: topo + 1 }, (_, i) => i) }
  }
  const bruto = maximo / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)!
  const topo = passo * Math.ceil(maximo / passo)
  return { topo, passos: Array.from({ length: topo / passo + 1 }, (_, i) => i * passo) }
}

/** Largura real do contêiner, para desenhar o SVG no tamanho da tela (texto sem encolher). */
export function useLargura() {
  const [largura, setLargura] = useState(0)
  const ref = useCallback((no: HTMLDivElement | null) => {
    if (!no) return
    setLargura(no.clientWidth)
    const obs = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width)))
    obs.observe(no)
    return () => obs.disconnect()
  }, [])
  return [ref, largura] as const
}
