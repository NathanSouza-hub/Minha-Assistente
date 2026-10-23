import { useCallback, useState, type ReactNode } from 'react'
import { formatarCentavos } from '@/lib/dinheiro'
import { cn } from '@/lib/utils'
import { mesCurto, reaisCompacto } from './formatos'

/*
 * Gráficos da Visão geral, desenhados à mão (SVG/HTML) para não trazer uma biblioteca só para isso.
 * Regras: uma escala por gráfico começando no zero, valores em R$ por extenso no tooltip, na legenda
 * e na tabela ("Ver os números"), e a cor nunca sozinha (legenda com o nome de cada série).
 * Cores conferidas com o validador de paleta (daltonismo e contraste com o branco).
 */
export const COR_ENTRADA = '#0f8a6a'
export const COR_SAIDA = '#c08a1e'
const COR_SALDO = 'var(--grafite)'
const COR_GRADE = 'var(--linha)'

/** Limite "redondo" do eixo e os 4 intervalos entre 0 e ele. */
function escala(maximo: number) {
  if (maximo <= 0) return { topo: 100_00, passos: [0, 25_00, 50_00, 75_00, 100_00] }
  const bruto = maximo / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)!
  return { topo: passo * 4, passos: [0, 1, 2, 3, 4].map((i) => i * passo) }
}

/** Largura real do contêiner, para desenhar o SVG no tamanho da tela (texto sem encolher). */
function useLargura() {
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

/** Tabela com os mesmos números do gráfico, recolhida (leitores de tela e quem prefere ler). */
export function TabelaDoGrafico({ colunas, linhas }: { colunas: string[]; linhas: (string | number)[][] }) {
  return (
    <details className="text-apoio">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-muted-foreground hover:text-foreground">
        Ver os números
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <thead>
            <tr className="border-b border-linha text-muted-foreground">
              {colunas.map((c, i) => (
                <th key={c} scope="col" className={cn('py-1.5 font-semibold', i > 0 && 'text-right')}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-linha">
            {linhas.map((l) => (
              <tr key={String(l[0])}>
                {l.map((v, i) => (
                  <td key={i} className={cn('py-1.5', i > 0 && 'text-right')}>
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

function Dica({ x, alinhar, children }: { x: number; alinhar: 'esquerda' | 'direita'; children: ReactNode }) {
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

const LINHA_DICA = 'flex items-center justify-between gap-4'

// ---------------------------------------------------------------------------------------------

export type PontoFluxo = { mes: string; entradas: number; saidas: number }

/**
 * A · Fluxo mensal: o que entrou (recebido no mês) e o que saiu (pago no mês), lado a lado por mês.
 * Tocar/passar num mês mostra os dois valores e a diferença.
 */
export function GraficoFluxo({ pontos }: { pontos: PontoFluxo[] }) {
  const [ref, largura] = useLargura()
  const [ativo, setAtivo] = useState<number | null>(null)
  const altura = 200
  const margem = { esq: 64, dir: 8, topo: 12, base: 28 }
  const { topo, passos } = escala(Math.max(...pontos.flatMap((p) => [p.entradas, p.saidas])))
  const areaL = Math.max(largura - margem.esq - margem.dir, 0)
  const areaA = altura - margem.topo - margem.base
  const banda = areaL / pontos.length
  const barra = Math.min(22, Math.max(6, (banda - 14) / 2))
  const y = (v: number) => margem.topo + areaA - (v / topo) * areaA
  const anoMuda = pontos.some((p) => p.mes.slice(0, 4) !== pontos[0].mes.slice(0, 4))

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setAtivo(null)}>
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label="Entradas e saídas de cada mês; os números estão na tabela abaixo">
          {passos.map((p) => (
            <g key={p}>
              <line x1={margem.esq} x2={largura - margem.dir} y1={y(p)} y2={y(p)} stroke={COR_GRADE} strokeWidth={1} />
              <text x={margem.esq - 8} y={y(p) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {reaisCompacto(p)}
              </text>
            </g>
          ))}
          {pontos.map((p, i) => {
            const cx = margem.esq + banda * i + banda / 2
            const barraY = (v: number) => ({ y: y(v), h: Math.max(y(0) - y(v), v > 0 ? 2 : 0) })
            const e = barraY(p.entradas)
            const s = barraY(p.saidas)
            return (
              <g key={p.mes}>
                {ativo === i && (
                  <rect x={cx - banda / 2 + 2} y={margem.topo} width={banda - 4} height={areaA} rx={8} fill="var(--suave)" />
                )}
                <Coluna x={cx - barra - 1} y={e.y} largura={barra} altura={e.h} cor={COR_ENTRADA} />
                <Coluna x={cx + 1} y={s.y} largura={barra} altura={s.h} cor={COR_SAIDA} />
                <text x={cx} y={altura - 8} textAnchor="middle" className="fill-muted-foreground text-[12px]">
                  {mesCurto(p.mes, anoMuda && (i === 0 || p.mes.endsWith('-01')))}
                </text>
                {/* Área de toque maior que as barras. */}
                <rect
                  x={cx - banda / 2}
                  y={0}
                  width={banda}
                  height={altura}
                  fill="transparent"
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => setAtivo(ativo === i ? null : i)}
                />
              </g>
            )
          })}
        </svg>
      )}
      {ativo !== null && largura > 0 && (
        <Dica
          {...(ativo < pontos.length / 2
            ? { alinhar: 'esquerda' as const, x: margem.esq + banda * (ativo + 1) }
            : { alinhar: 'direita' as const, x: largura - (margem.esq + banda * ativo) })}
        >
          <p className="font-bold">{mesCurto(pontos[ativo].mes, true)}</p>
          <p className={LINHA_DICA}>
            <span>Entrou</span>
            <span className="tabular-nums">{formatarCentavos(pontos[ativo].entradas)}</span>
          </p>
          <p className={LINHA_DICA}>
            <span>Saiu</span>
            <span className="tabular-nums">{formatarCentavos(pontos[ativo].saidas)}</span>
          </p>
          <p className={cn(LINHA_DICA, 'mt-1 border-t border-white/20 pt-1 font-bold')}>
            <span>Diferença</span>
            <span className="tabular-nums">{formatarCentavos(pontos[ativo].entradas - pontos[ativo].saidas)}</span>
          </p>
        </Dica>
      )}
    </div>
  )
}

/** Coluna com a ponta de cima arredondada (4px) e a base reta no eixo. */
function Coluna({ x, y, largura, altura, cor }: { x: number; y: number; largura: number; altura: number; cor: string }) {
  if (altura <= 0) return null
  const r = Math.min(4, altura, largura / 2)
  return (
    <path
      d={`M${x},${y + altura} V${y + r} Q${x},${y} ${x + r},${y} H${x + largura - r} Q${x + largura},${y} ${x + largura},${y + r} V${y + altura} Z`}
      fill={cor}
    />
  )
}

// ---------------------------------------------------------------------------------------------

export type PontoResultado = { mes: string; realizado: number | null; projetado: number | null }

/**
 * C · Resultado mês a mês: linha cheia = realizado (recebido − pago no mês, até o mês atual);
 * linha tracejada = projeção (previsto a receber − contas que vencem no mês, do mês atual em
 * diante). Não é o saldo do banco: o app não conhece o saldo das contas bancárias.
 */
export function GraficoResultado({ pontos }: { pontos: PontoResultado[] }) {
  const [ref, largura] = useLargura()
  const [ativo, setAtivo] = useState<number | null>(null)
  const altura = 200
  const margem = { esq: 64, dir: 12, topo: 14, base: 28 }
  const valores = pontos.flatMap((p) => [p.realizado, p.projetado]).filter((v): v is number => v !== null)
  const maxAbs = Math.max(...valores.map(Math.abs), 0)
  const temNegativo = valores.some((v) => v < 0)
  const temPositivo = valores.some((v) => v > 0)
  const { topo, passos } = escala(maxAbs)
  // Eixo de −topo a +topo só quando há negativos e positivos; senão, de 0 até o topo do lado certo.
  const minimo = temNegativo ? -topo : 0
  const maximo = temPositivo || !temNegativo ? topo : 0
  const marcas = [...new Set([...(temNegativo ? passos.map((p) => -p) : []), ...(maximo > 0 ? passos : [])])].sort(
    (a, b) => a - b,
  )
  const ticks = temNegativo && temPositivo ? marcas.filter((_, i) => i % 2 === 0) : marcas
  const areaL = Math.max(largura - margem.esq - margem.dir, 0)
  const areaA = altura - margem.topo - margem.base
  const banda = areaL / pontos.length
  const x = (i: number) => margem.esq + banda * i + banda / 2
  const y = (v: number) => margem.topo + ((maximo - v) / (maximo - minimo)) * areaA
  const caminho = (chave: 'realizado' | 'projetado') =>
    pontos
      .map((p, i) => (p[chave] === null ? null : `${x(i)},${y(p[chave]!)}`))
      .filter(Boolean)
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt}`)
      .join(' ')
  const anoMuda = pontos.some((p) => p.mes.slice(0, 4) !== pontos[0].mes.slice(0, 4))

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setAtivo(null)}>
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label="Resultado de cada mês, realizado e projetado; os números estão na tabela abaixo">
          {ticks.map((p) => (
            <g key={p}>
              <line
                x1={margem.esq}
                x2={largura - margem.dir}
                y1={y(p)}
                y2={y(p)}
                stroke={p === 0 ? 'var(--contorno)' : COR_GRADE}
                strokeWidth={1}
              />
              <text x={margem.esq - 8} y={y(p) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {reaisCompacto(p)}
              </text>
            </g>
          ))}
          {ativo !== null && (
            <line x1={x(ativo)} x2={x(ativo)} y1={margem.topo} y2={margem.topo + areaA} stroke="var(--contorno)" strokeWidth={1} />
          )}
          <path d={caminho('projetado')} fill="none" stroke={COR_SALDO} strokeOpacity={0.55} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
          <path d={caminho('realizado')} fill="none" stroke={COR_SALDO} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {pontos.map((p, i) => (
            <g key={p.mes}>
              {p.projetado !== null && (
                <circle cx={x(i)} cy={y(p.projetado)} r={4.5} fill="var(--folha)" stroke={COR_SALDO} strokeOpacity={0.7} strokeWidth={2} />
              )}
              {p.realizado !== null && (
                <circle cx={x(i)} cy={y(p.realizado)} r={4.5} fill={COR_SALDO} stroke="var(--folha)" strokeWidth={2} />
              )}
              <text x={x(i)} y={altura - 8} textAnchor="middle" className="fill-muted-foreground text-[12px]">
                {mesCurto(p.mes, anoMuda && (i === 0 || p.mes.endsWith('-01')))}
              </text>
              <rect
                x={x(i) - banda / 2}
                y={0}
                width={banda}
                height={altura}
                fill="transparent"
                onMouseEnter={() => setAtivo(i)}
                onClick={() => setAtivo(ativo === i ? null : i)}
              />
            </g>
          ))}
        </svg>
      )}
      {ativo !== null && largura > 0 && (
        <Dica
          {...(ativo < pontos.length / 2
            ? { alinhar: 'esquerda' as const, x: x(ativo) + 12 }
            : { alinhar: 'direita' as const, x: largura - x(ativo) + 12 })}
        >
          <p className="font-bold">{mesCurto(pontos[ativo].mes, true)}</p>
          {pontos[ativo].realizado !== null && (
            <p className={LINHA_DICA}>
              <span>Realizado</span>
              <span className="tabular-nums">{formatarCentavos(pontos[ativo].realizado!)}</span>
            </p>
          )}
          {pontos[ativo].projetado !== null && (
            <p className={LINHA_DICA}>
              <span>Projetado</span>
              <span className="tabular-nums">{formatarCentavos(pontos[ativo].projetado!)}</span>
            </p>
          )}
        </Dica>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

export type ItemCategoria = { nome: string; total: number; pago: number }

/**
 * B · Despesas por categoria: barras horizontais da maior para a menor, com o valor e a parte do
 * total. Uma série só (sem legenda); o título diz o que é.
 */
export function GraficoCategorias({ itens }: { itens: ItemCategoria[] }) {
  const ordenados = [...itens].filter((i) => i.total > 0).sort((a, b) => b.total - a.total)
  const total = ordenados.reduce((s, i) => s + i.total, 0)
  const maior = ordenados[0]?.total ?? 1
  return (
    <ul className="flex flex-col gap-3.5">
      {ordenados.map((i) => {
        const parte = total ? Math.round((i.total / total) * 100) : 0
        return (
          <li key={i.nome} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-base">
              <span className="min-w-0 truncate font-semibold">{i.nome}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-bold">{formatarCentavos(i.total)}</span>
                <span className="text-muted-foreground"> · {parte}%</span>
              </span>
            </div>
            <div className="h-3 rounded-r-[4px]" title={`${i.nome}: ${formatarCentavos(i.total)} (${parte}% do total)`}>
              <div
                className="h-full rounded-r-[4px]"
                style={{ width: `${Math.max((i.total / maior) * 100, 1.5)}%`, background: COR_SAIDA }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
