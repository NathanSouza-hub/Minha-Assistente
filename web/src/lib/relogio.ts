import { useEffect, useReducer } from 'react'
import { agora } from '@/lib/datas'

/**
 * "HH:mm" de agora, que avança sozinho na virada de cada minuto (um timer só, reagendado a cada
 * virada). A hora é lida na renderização (nunca fica velha); o timer só pede uma renderização nova.
 * Com a aba escondida não agenda nada; ao voltar, atualiza na hora. Desligado (`ativo` falso) não
 * cria timer. Desmontar limpa o timer e o ouvinte.
 */
export function useMinutoAtual(ativo = true) {
  const [, renderizar] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!ativo) return
    let timer: ReturnType<typeof setTimeout> | undefined

    const agendar = () => {
      clearTimeout(timer)
      timer = undefined
      if (document.visibilityState === 'hidden') return
      const t = agora()
      // Até o próximo minuto cheio (+50ms de folga para não cair no mesmo minuto).
      const espera = 60_000 - (t.second * 1000 + t.millisecond) + 50
      timer = setTimeout(() => {
        renderizar()
        agendar()
      }, espera)
    }
    const aoMudarVisibilidade = () => {
      renderizar()
      agendar()
    }

    agendar()
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    }
  }, [ativo])

  return agora().toFormat('HH:mm')
}
