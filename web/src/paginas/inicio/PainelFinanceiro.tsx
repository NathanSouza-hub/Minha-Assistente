import type { ReactNode } from 'react'
import { CaretRightIcon, ChartBarIcon, CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useQueries } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Abas } from '@/components/Abas'
import { Pagina } from '@/components/layout/Pagina'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { chaves, useRelatorioFinanceiro, useRelatorioGastos } from '@/consultas/pagamentos'
import { api } from '@/lib/api'
import { intervaloDoMes, mesDe, nomeDoMes, somarMeses } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { RelatorioFinanceiro } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import {
  COR_ENTRADA,
  COR_SAIDA,
  GraficoCategorias,
  GraficoFluxo,
  GraficoResultado,
  Legenda,
  TabelaDoGrafico,
} from '@/paginas/financas/graficos'
import { mesCurto } from '@/paginas/financas/formatos'
import { NavegadorMes } from '@/paginas/pagamentos/ResumoContas'
import { RelatorioDoPeriodo } from '@/paginas/Relatorio'
import { BlocoFinancas } from './blocosFinanceiros'

/** Meses do histórico (até o escolhido) e da projeção (depois dele) nos gráficos. */
const MESES_ANTES = 5
const MESES_DEPOIS = 2

/**
 * Finanças → Visão geral (`/financas`): as abas Resumo (padrão) e Relatório (`?vista=relatorio`).
 * O Resumo é o painel do mês escolhido (`?mes=`): saldo, o que pede atenção, os números com o
 * critério de cada um, os gráficos e as residências. Só lê: todo número vem de
 * GET /relatorios/financeiro (um por mês, nos gráficos) e /relatorios/gastos — nada é somado aqui
 * além de juntar os meses lado a lado.
 */
export function PainelFinanceiro() {
  return (
    <Pagina titulo="Finanças" larga>
      <Abas<'resumo' | 'relatorio'>
        rotulo="Visão geral"
        abas={[
          { valor: 'resumo', rotulo: 'Resumo do mês', conteudo: <ResumoDoMes /> },
          { valor: 'relatorio', rotulo: 'Relatório', conteudo: <RelatorioDoPeriodo /> },
        ]}
      />
    </Pagina>
  )
}

function ResumoDoMes() {
  const [params, setParams] = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesDe()
  const financeiro = useRelatorioFinanceiro(intervaloDoMes(mes))
  const mudarMes = (novo: string) =>
    setParams(
      (antes) => {
        const p = new URLSearchParams(antes)
        if (novo === mesDe()) p.delete('mes')
        else p.set('mes', novo)
        return p
      },
      { replace: true },
    )

  return (
    <div className="flex flex-col gap-6">
      <NavegadorMes mes={mes} aoMudar={mudarMes} />
      {financeiro.data && <Atencao r={financeiro.data} mes={mes} />}
      <BlocoFinancas consulta={financeiro} mes={mes} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <FluxoEResultado mes={mes} />
        <div className="flex min-w-0 flex-col gap-6">
          <Categorias mes={mes} />
          {financeiro.data && <PorResidencia r={financeiro.data} />}
        </div>
      </div>
    </div>
  )
}

/** O que precisa de ação no mês: contas vencidas, recebíveis atrasados e contas sem valor. */
function Atencao({ r, mes }: { r: RelatorioFinanceiro; mes: string }) {
  // Os vencidos do relatório são das contas e recebíveis DESTE mês (vencimento/data prevista nele).
  const nomeMes = nomeDoMes(mes).split(' ')[0].toLowerCase()
  const itens: { texto: ReactNode; para: string }[] = []
  if (r.saidas.vencidoCentavos > 0)
    itens.push({
      texto: (
        <>
          <strong>{formatarCentavos(r.saidas.vencidoCentavos)}</strong> em contas de {nomeMes} já vencidas
        </>
      ),
      para: `/despesas?mes=${mes}&status=pendente`,
    })
  if (r.entradas.vencidoCentavos > 0)
    itens.push({
      texto: (
        <>
          <strong>{formatarCentavos(r.entradas.vencidoCentavos)}</strong> em recebíveis de {nomeMes} atrasados
        </>
      ),
      para: `/recebiveis?mes=${mes}`,
    })
  if (r.saidas.contasADefinir > 0)
    itens.push({
      texto:
        r.saidas.contasADefinir === 1
          ? '1 conta da equipe com o valor a definir'
          : `${r.saidas.contasADefinir} contas da equipe com o valor a definir`,
      para: '/pagamentos?aba=equipe',
    })

  if (itens.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-[1.25rem] bg-ok-fundo px-4 py-3 font-semibold text-ok">
        <CheckCircleIcon weight="fill" className="size-5 shrink-0" aria-hidden />
        Nenhuma conta nem recebível de {nomeMes} vencido.
      </p>
    )
  return (
    <section aria-labelledby="atencao" className="rounded-[1.5rem] bg-atraso-fundo p-2">
      <h2 id="atencao" className="flex items-center gap-2 px-3 pt-2 pb-1 font-bold text-atraso">
        <WarningCircleIcon weight="fill" className="size-5" aria-hidden />
        Pede atenção
      </h2>
      <ul className="flex flex-col">
        {itens.map((i) => (
          <li key={i.para}>
            <Link to={i.para} className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 hover:bg-white/50">
              <span>{i.texto}</span>
              <CaretRightIcon weight="bold" className="size-4 shrink-0 text-atraso" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Cartao({ id, titulo, nota, children, className }: { id: string; titulo: string; nota?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('superficie flex min-w-0 flex-col gap-3 p-4 md:p-5', className)}>
      <div>
        <h2 id={id} className="text-secao font-bold">
          {titulo}
        </h2>
        {nota && <p className="mt-0.5 text-apoio text-muted-foreground">{nota}</p>}
      </div>
      {children}
    </section>
  )
}

function Carregando({ rotulo }: { rotulo: string }) {
  return (
    <div role="status" aria-label={rotulo}>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

/**
 * Mês da tabela; o atual avisa que o realizado ainda está correndo, e o mês sem nada recebido nem
 * pago diz isso embaixo (os R$ 0,00 são reais, não falta de dado).
 */
function rotuloMes(mes: string, atual: string, semMovimento = false) {
  const nome = `${mesCurto(mes, true)}${mes === atual ? ' (até hoje)' : ''}`
  if (!semMovimento) return nome
  return (
    <>
      {nome}
      <span className="block text-sm text-muted-foreground">sem movimento</span>
    </>
  )
}

/** Os relatórios de vários meses (mesma chave do `useRelatorioFinanceiro`: o mês aberto vem do cache). */
function useMeses(meses: string[]) {
  return useQueries({
    queries: meses.map((m) => {
      const periodo = intervaloDoMes(m)
      return {
        queryKey: [...chaves.relatorio, 'financeiro', periodo],
        queryFn: () => api<RelatorioFinanceiro>('/relatorios/financeiro', { query: periodo }),
        staleTime: 60_000,
      }
    }),
  })
}

/** A (fluxo) e C (resultado) usam os mesmos meses: o histórico até o mês escolhido e dois à frente. */
function FluxoEResultado({ mes }: { mes: string }) {
  const meses = Array.from({ length: MESES_ANTES + 1 + MESES_DEPOIS }, (_, i) => somarMeses(mes, i - MESES_ANTES))
  const consultas = useMeses(meses)
  const atual = mesDe()
  const carregando = consultas.some((c) => c.isPending)
  const erro = consultas.some((c) => c.isError)
  const tentarDeNovo = () => consultas.filter((c) => c.isError).forEach((c) => c.refetch())
  const dados = consultas.map((c) => c.data)

  const historico = meses.slice(0, MESES_ANTES + 1).filter((m) => m <= atual)
  const fluxo = historico.map((m) => {
    const r = dados[meses.indexOf(m)]!
    return { mes: m, entradas: r?.entradas.recebidoNoPeriodoCentavos ?? 0, saidas: r?.saidas.pagoNoPeriodoCentavos ?? 0 }
  })
  const semMovimento = (i: number) =>
    dados[i]?.entradas.recebidoNoPeriodoCentavos === 0 && dados[i]?.saidas.pagoNoPeriodoCentavos === 0
  const resultado = meses.map((m, i) => ({
    mes: m,
    realizado: m <= atual ? (dados[i]?.saldo.realizadoCentavos ?? null) : null,
    semMovimento: m <= atual && semMovimento(i),
    projetado: m >= atual ? (dados[i]?.saldo.projetadoCentavos ?? null) : null,
  }))

  const conteudo = (grafico: ReactNode) =>
    carregando ? (
      <Carregando rotulo="Carregando gráfico" />
    ) : erro ? (
      <div className="flex flex-col items-start gap-2">
        <p className="text-muted-foreground">Não foi possível carregar os meses. Verifique a internet.</p>
        <Button variant="outline" size="sm" onClick={tentarDeNovo}>
          Tentar de novo
        </Button>
      </div>
    ) : (
      grafico
    )

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Cartao id="grafico-fluxo" titulo="Entradas e saídas" nota="O que foi recebido e pago em cada mês (pela data do recebimento e do pagamento).">
        {conteudo(
          fluxo.length === 0 ? (
            <p className="text-muted-foreground">Este mês ainda não começou: não há o que mostrar.</p>
          ) : fluxo.every((p) => p.entradas === 0 && p.saidas === 0) ? (
            <p className="text-muted-foreground">Nada recebido nem pago nesses meses.</p>
          ) : (
            <>
              <Legenda
                itens={[
                  { nome: 'Recebido', cor: COR_ENTRADA },
                  { nome: 'Pago', cor: COR_SAIDA },
                ]}
              />
              <GraficoFluxo pontos={fluxo} />
              <TabelaDoGrafico
                // Sem "Diferença": é o Realizado da tabela do Resultado, logo abaixo (e está na dica).
                colunas={['Mês', 'Recebido', 'Pago']}
                linhas={fluxo.map((p) => [
                  rotuloMes(p.mes, atual, p.entradas === 0 && p.saidas === 0),
                  formatarCentavos(p.entradas),
                  formatarCentavos(p.saidas),
                ])}
              />
            </>
          ),
        )}
      </Cartao>
      <Cartao
        id="grafico-resultado"
        titulo="Resultado mês a mês"
        nota="Recebido menos pago em cada mês. Do mês atual em diante, a projeção usa os recebíveis previstos e as contas que vencem no mês. Não é o saldo do banco."
      >
        {conteudo(
          <>
            <Legenda
              itens={[
                { nome: 'Realizado', cor: 'var(--grafite)', linha: true },
                { nome: 'Projetado', cor: 'var(--grafite)', linha: true, tracejado: true },
              ]}
            />
            <GraficoResultado pontos={resultado} />
            <TabelaDoGrafico
              colunas={['Mês', 'Realizado', 'Projetado']}
              linhas={resultado.map((p) => [
                rotuloMes(p.mes, atual, p.semMovimento),
                p.realizado === null ? '—' : formatarCentavos(p.realizado),
                p.projetado === null ? '—' : formatarCentavos(p.projetado),
              ])}
            />
          </>,
        )}
      </Cartao>
    </div>
  )
}

/** B · Despesas do mês por categoria (pagas + a pagar), de GET /relatorios/gastos. */
function Categorias({ mes }: { mes: string }) {
  const gastos = useRelatorioGastos({ ...intervaloDoMes(mes), agruparPor: 'categoria' })
  const itens = (gastos.data?.itens ?? []).map((i) => ({
    nome: i.nome,
    pago: i.pagoCentavos,
    total: i.pagoCentavos + i.previstoCentavos,
  }))
  const total = (gastos.data?.totalPagoCentavos ?? 0) + (gastos.data?.totalPrevistoCentavos ?? 0)
  return (
    <Cartao
      id="grafico-categorias"
      titulo="Despesas por categoria"
      nota={
        gastos.data
          ? `${formatarCentavos(total)} no mês: pagas no mês e as que vencem nele e ainda não foram pagas.`
          : 'Pagas no mês e as que vencem nele e ainda não foram pagas.'
      }
    >
      {gastos.isPending ? (
        <Carregando rotulo="Carregando categorias" />
      ) : gastos.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-muted-foreground">Não foi possível carregar as categorias.</p>
          <Button variant="outline" size="sm" onClick={() => gastos.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : itens.every((i) => i.total === 0) ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
          <ChartBarIcon className="size-8" aria-hidden />
          Nenhuma despesa neste mês.
        </div>
      ) : (
        <GraficoCategorias itens={itens} total={total} />
      )}
    </Cartao>
  )
}

/** Quanto cada residência custa no mês e quanto já foi pago (do mesmo relatório do mês). */
function PorResidencia({ r }: { r: RelatorioFinanceiro }) {
  if (r.imoveis.length === 0) return null
  return (
    <section aria-labelledby="por-residencia" className="flex flex-col gap-2">
      <h2 id="por-residencia" className="text-secao font-bold">
        Por residência
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {r.imoveis.map((i) => {
          const pago = i.totalCentavos ? Math.round((i.pagoCentavos / i.totalCentavos) * 100) : 0
          return (
            <li key={i.id}>
              <Link to={`/imoveis/${i.id}`} className="area-contas flex h-full flex-col gap-1 rounded-[1.4rem] bg-area-fundo p-4 hover:brightness-[0.97]">
                <span className="flex items-center justify-between gap-2 font-semibold text-area">
                  <span className="min-w-0 truncate">{i.nome}</span>
                  <CaretRightIcon weight="bold" className="size-4 shrink-0" aria-hidden />
                </span>
                <span className="font-heading text-[1.5rem] leading-tight font-bold text-grafite">
                  {formatarCentavos(i.totalCentavos)}
                </span>
                {i.totalCentavos > 0 ? (
                  <>
                    <span
                      role="progressbar"
                      aria-label={`Pago de ${i.nome}`}
                      aria-valuenow={pago}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-1 h-2 overflow-hidden rounded-full bg-white/70"
                    >
                      <span className="block h-full rounded-full bg-area" style={{ width: `${pago}%` }} />
                    </span>
                    <span className="text-apoio text-area">
                      {formatarCentavos(i.pagoCentavos)} pago
                      {i.vencidoCentavos > 0 && ` · ${formatarCentavos(i.vencidoCentavos)} vencido`}
                    </span>
                  </>
                ) : (
                  <span className="text-apoio text-area">Sem contas no mês</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
