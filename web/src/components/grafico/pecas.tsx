import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * Peças dos gráficos desenhados à mão (SVG/HTML, sem biblioteca), usadas por Finanças e por "O que
 * foi feito". Escala e largura ficam em `lib/grafico.ts`.
 */

/** `linha`: a chave é um traço (séries de linha); `tracejado` para a projeção. */
export function Legenda({ itens }: { itens: { nome: string; cor: string; linha?: boolean; tracejado?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-apoio text-muted-foreground">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-2">
          {i.linha ? (
            <svg width="18" height="8" aria-hidden>
              <line x1="1" y1="4" x2="17" y2="4" stroke={i.cor} strokeWidth="2" strokeDasharray={i.tracejado ? '4 3' : undefined} />
            </svg>
          ) : (
            <span aria-hidden className="size-3 rounded-[3px]" style={{ background: i.cor }} />
          )}
          {i.nome}
        </li>
      ))}
    </ul>
  )
}

/**
 * Tabela com os mesmos números do gráfico, recolhida (leitores de tela e quem prefere ler). Valores
 * nunca quebram no meio ("−R$ 6.000,00" inteiro); se não couber no celular, a tabela rola sozinha.
 */
export function TabelaDoGrafico({ colunas, linhas }: { colunas: string[]; linhas: ReactNode[][] }) {
  return (
    <details className="text-apoio">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-muted-foreground hover:text-foreground">
        Ver os números
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums sm:text-apoio">
          <thead>
            <tr className="border-b border-linha text-muted-foreground">
              {colunas.map((c, i) => (
                <th key={c} scope="col" className={cn('py-1.5 font-semibold', i > 0 && 'pl-2.5 text-right whitespace-nowrap')}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-linha">
            {linhas.map((l, n) => (
              <tr key={n}>
                {l.map((v, i) => (
                  <td key={i} className={cn('py-1.5 align-top', i > 0 && 'pl-2.5 text-right whitespace-nowrap')}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function Dica({ x, alinhar, children }: { x: number; alinhar: 'esquerda' | 'direita'; children: ReactNode }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 min-w-44 rounded-xl bg-grafite px-3 py-2 text-apoio text-white shadow-lg"
      style={alinhar === 'esquerda' ? { left: x } : { right: x }}
    >
      {children}
    </div>
  )
}

/** Coluna com a ponta de cima arredondada (4px) e a base reta no eixo. */
export function Coluna({ x, y, largura, altura, cor }: { x: number; y: number; largura: number; altura: number; cor: string }) {
  if (altura <= 0) return null
  const r = Math.min(4, altura, largura / 2)
  return (
    <path
      d={`M${x},${y + altura} V${y + r} Q${x},${y} ${x + r},${y} H${x + largura - r} Q${x + largura},${y} ${x + largura},${y + r} V${y + altura} Z`}
      fill={cor}
    />
  )
}
