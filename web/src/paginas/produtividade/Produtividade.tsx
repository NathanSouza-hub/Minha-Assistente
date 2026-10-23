import { useState } from 'react'
import { ChartBarIcon } from '@phosphor-icons/react'
import { useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useProdutividade } from '@/consultas/produtividade'
import { deDataISO, diaCurto, hojeISO, inicioDaSemana, somarDias } from '@/lib/datas'
import type { Concluidos } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { Coluna, Dica, TabelaDoGrafico } from '@/components/grafico/pecas'
import { escalaInteira, useLargura } from '@/lib/grafico'

type Faixa = '7' | '30' | '12s'
const FAIXAS: Faixa[] = ['7', '30', '12s']

/** Último dia é sempre hoje; 12 semanas começam numa segunda, para as semanas virem inteiras. */
function periodoDa(faixa: Faixa, hoje = hojeISO()) {
  if (faixa === '12s') return { inicio: somarDias(inicioDaSemana(hoje), -77), fim: hoje }
  return { inicio: somarDias(hoje, faixa === '7' ? -6 : -29), fim: hoje }
}

const COR = 'var(--area-tarefas)'

/**
 * /produtividade: o que foi concluído (tarefas de uma vez e compromissos que repetem), por dia ou
 * por semana, de GET /relatorios/produtividade. Só o que foi feito de fato: o app não guarda o que
 * estava previsto em cada dia do passado, então não há "pendente" nem taxa aqui.
 */
export function Produtividade() {
  const [params, setParams] = useSearchParams()
  const faixa: Faixa = params.get('periodo') === '7' || params.get('periodo') === '12s' ? (params.get('periodo') as Faixa) : '30'
  const periodo = periodoDa(faixa)
  const consulta = useProdutividade(periodo)
  const r = consulta.data
  // Enquanto o período novo carrega, o anterior continua na tela (apagado): rótulos e agrupamento
  // seguem o período dos dados mostrados, nunca o escolhido.
  const faixaDosDados = FAIXAS.find((f) => r && periodoDa(f).inicio === r.inicio && periodoDa(f).fim === r.fim) ?? faixa
  const porSemana = faixaDosDados === '12s'

  return (
    <Pagina titulo="O que foi feito">
      <div className="flex flex-col gap-5">
        <Opcoes<Faixa>
          rotulo="Período"
          rotuloOculto
          formato="segmentos"
          valor={faixa}
          aoMudar={(v) => setParams(v === '30' ? {} : { periodo: v }, { replace: true })}
          opcoes={[
            { valor: '7', rotulo: '7 dias' },
            { valor: '30', rotulo: '30 dias' },
            { valor: '12s', rotulo: '12 semanas' },
          ]}
        />

        {consulta.isPending ? (
          <div role="status" aria-label="Carregando o que foi feito" className="flex flex-col gap-4">
            <Skeleton className="h-28 rounded-[1.4rem]" />
            <Skeleton className="h-64 rounded-[1.4rem]" />
          </div>
        ) : consulta.isError || !r ? (
          <EstadoVazio
            icone={ChartBarIcon}
            titulo="Não foi possível carregar o que foi feito"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          >
            Verifique a internet e tente de novo.
          </EstadoVazio>
        ) : (
          <div className={cn('flex flex-col gap-5', consulta.isPlaceholderData && 'opacity-60')} aria-busy={consulta.isPlaceholderData}>
            <Totais total={r.total} faixa={faixaDosDados} />
            {r.total.total === 0 ? (
              <EstadoVazio icone={ChartBarIcon} titulo="Nada concluído nesse período">
                Quando marcar uma tarefa ou um compromisso como feito, ele aparece aqui no dia em que foi marcado.
              </EstadoVazio>
            ) : (
              <section aria-labelledby="grafico-feitos" className="superficie flex min-w-0 flex-col gap-3 p-4 md:p-5">
                <div>
                  <h2 id="grafico-feitos" className="text-secao font-bold">
                    {porSemana ? 'Concluídos por semana' : 'Concluídos por dia'}
                  </h2>
                  <p className="mt-0.5 text-apoio text-muted-foreground">
                    Pelo dia em que foi marcado como feito. Dia sem nada concluído aparece com um traço no zero.
                  </p>
                </div>
                <GraficoConcluidos
                  // Período novo = gráfico novo: a coluna destacada (toque) não sobra de outro período.
                  key={`${r.inicio}-${r.fim}-${porSemana}`}
                  barras={
                    porSemana
                      ? r.semanas.map((s) => ({ chave: s.inicio, ...s, rotulo: rotuloSemana(s.inicio, s.fim) }))
                      : r.dias.map((d) => ({ chave: d.data, ...d, rotulo: diaCurto(d.data) }))
                  }
                  eixo={(i, n) => (porSemana ? eixoSemana(r.semanas[i].inicio) : eixoDia(r.dias[i].data, i, n))}
                />
                <TabelaDoGrafico
                  colunas={[porSemana ? 'Semana' : 'Dia', 'Tarefas', 'Compromissos', 'Total']}
                  linhas={(porSemana ? r.semanas.map((s) => ({ ...s, rotulo: rotuloSemana(s.inicio, s.fim) })) : r.dias.map((d) => ({ ...d, rotulo: diaCurto(d.data) })))
                    .map((b) => [b.rotulo, b.tarefas, b.compromissos, b.total])}
                />
              </section>
            )}
            <p className="text-apoio text-muted-foreground">
              Conta o que foi marcado como feito. Tarefa reaberta ou excluída não entra. O que ficou por fazer
              não aparece aqui: o app não guarda o que estava previsto em cada dia do passado.
            </p>
          </div>
        )}
      </div>
    </Pagina>
  )
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

function Totais({ total, faixa }: { total: Concluidos; faixa: Faixa }) {
  const quando = faixa === '7' ? 'nos últimos 7 dias' : faixa === '30' ? 'nos últimos 30 dias' : 'nas últimas 12 semanas'
  return (
    <section aria-label="Total do período" className="area-tarefas flex flex-wrap items-end justify-between gap-x-6 gap-y-2 rounded-[1.4rem] bg-area-fundo px-5 py-4">
      <p className="flex flex-col">
        <span className="text-apoio font-bold text-area">Concluídos {quando}</span>
        <span className="font-heading text-[2.2rem] leading-none font-bold tracking-[-0.02em] text-grafite tabular-nums">
          {total.total}
        </span>
      </p>
      <p className="text-apoio font-semibold text-grafite">
        {plural(total.tarefas, 'tarefa', 'tarefas')} · {plural(total.compromissos, 'compromisso', 'compromissos')}
      </p>
    </section>
  )
}

const rotuloSemana = (inicio: string, fim: string) =>
  `${deDataISO(inicio).toFormat('dd/MM')} a ${deDataISO(fim).toFormat('dd/MM')}`
const eixoSemana = (inicio: string) => deDataISO(inicio).toFormat('dd/MM')

/** 7 dias: o dia da semana; 30 dias: o número do dia, de 5 em 5 a partir do último (hoje). */
function eixoDia(data: string, i: number, n: number) {
  if (n <= 7) return deDataISO(data).toFormat('ccc').replace('.', '')
  return (n - 1 - i) % 5 === 0 ? String(deDataISO(data).day) : ''
}

type Barra = Concluidos & { chave: string; rotulo: string }

/** Colunas de uma série só (o total), na cor de Lembretes; a dica separa tarefas e compromissos. */
function GraficoConcluidos({ barras, eixo }: { barras: Barra[]; eixo: (i: number, n: number) => string }) {
  const [ref, largura] = useLargura()
  const [ativo, setAtivo] = useState<number | null>(null)
  const altura = 200
  const margem = { esq: 32, dir: 8, topo: 12, base: 28 }
  const { topo, passos } = escalaInteira(Math.max(...barras.map((b) => b.total)))
  const areaL = Math.max(largura - margem.esq - margem.dir, 0)
  const areaA = altura - margem.topo - margem.base
  const banda = areaL / barras.length
  const barra = Math.min(22, Math.max(4, banda - 4))
  const y = (v: number) => margem.topo + areaA - (v / topo) * areaA
  // Muitas linhas de grade em contagens pequenas: só as marcas pares quando passarem de 5.
  const marcas = passos.length > 5 ? passos.filter((_, i) => i % 2 === 0 || i === passos.length - 1) : passos

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setAtivo(null)}>
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label="Concluídos em cada período; os números estão na tabela abaixo">
          {marcas.map((p) => (
            <g key={p}>
              <line x1={margem.esq} x2={largura - margem.dir} y1={y(p)} y2={y(p)} stroke={p === 0 ? 'var(--contorno)' : 'var(--linha)'} strokeWidth={1} />
              <text x={margem.esq - 8} y={y(p) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {p}
              </text>
            </g>
          ))}
          {barras.map((b, i) => {
            const cx = margem.esq + banda * i + banda / 2
            const h = y(0) - y(b.total)
            return (
              <g key={b.chave}>
                {ativo === i && <rect x={cx - banda / 2 + 1} y={margem.topo} width={banda - 2} height={areaA} rx={6} fill="var(--suave)" />}
                <Coluna x={cx - barra / 2} y={y(b.total)} largura={barra} altura={h} cor={COR} />
                {b.total === 0 && (
                  <line x1={cx - Math.min(6, barra / 2)} x2={cx + Math.min(6, barra / 2)} y1={y(0)} y2={y(0)} stroke="var(--muted-foreground)" strokeWidth={2} strokeLinecap="round" />
                )}
                <text x={cx} y={altura - 8} textAnchor="middle" className="fill-muted-foreground text-[12px]">
                  {eixo(i, barras.length)}
                </text>
                <rect
                  x={cx - banda / 2}
                  y={0}
                  width={banda}
                  height={altura}
                  fill="transparent"
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => setAtivo(i)}
                />
              </g>
            )
          })}
        </svg>
      )}
      {ativo !== null && barras[ativo] && largura > 0 && (
        <Dica
          {...(ativo < barras.length / 2
            ? { alinhar: 'esquerda' as const, x: margem.esq + banda * (ativo + 1) }
            : { alinhar: 'direita' as const, x: largura - (margem.esq + banda * ativo) })}
        >
          <p className="font-bold">{barras[ativo].rotulo}</p>
          {barras[ativo].total === 0 ? (
            <p>Nada concluído.</p>
          ) : (
            <>
              <p className="flex items-center justify-between gap-4">
                <span>Tarefas</span>
                <span className="tabular-nums">{barras[ativo].tarefas}</span>
              </p>
              <p className="flex items-center justify-between gap-4">
                <span>Compromissos</span>
                <span className="tabular-nums">{barras[ativo].compromissos}</span>
              </p>
              <p className="mt-1 flex items-center justify-between gap-4 border-t border-white/20 pt-1 font-bold">
                <span>Total</span>
                <span className="tabular-nums">{barras[ativo].total}</span>
              </p>
            </>
          )}
        </Dica>
      )}
    </div>
  )
}
