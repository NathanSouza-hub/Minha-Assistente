import { useState, type ReactNode } from 'react'
import { ChartBarIcon, FilePdfIcon, ListBulletsIcon, ScalesIcon, UsersThreeIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Abas } from '@/components/Abas'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRelatorioFinanceiro, useRelatorioGastos } from '@/consultas/pagamentos'
import { agora, dataCurta, intervaloDoMes, mesDe, somarMeses } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { AgruparGastosPor, RelatorioFinanceiro, RelatorioGastos } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { ORIGENS } from '@/paginas/recebiveis/formulario'

type Atalho = 'este-mes' | 'mes-passado' | 'este-ano' | 'escolher'
type AbaRelatorio = 'balanco' | 'entradas' | 'gastos'

function periodoDoAtalho(atalho: Exclude<Atalho, 'escolher'>) {
  if (atalho === 'este-mes') return intervaloDoMes(mesDe())
  if (atalho === 'mes-passado') return intervaloDoMes(somarMeses(mesDe(), -1))
  const ano = agora().year
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` }
}

type Consulta<T> = { isPending: boolean; isError: boolean; data?: T; refetch: () => unknown }

/**
 * /relatorio: o período em cima (vale para tudo) e as abas Balanço (entradas, saídas e saldo),
 * Recebíveis e pessoais (por origem e as despesas sem imóvel) e Por imóvel ou categoria (gastos).
 * "Gerar PDF" leva os mesmos números do período e o "Separar por" escolhido (`lib/relatorioPdf.ts`).
 */
export function Relatorio() {
  const [atalho, setAtalho] = useState<Atalho>('este-mes')
  const [personalizado, setPersonalizado] = useState(periodoDoAtalho('este-mes'))
  const [agruparPor, setAgruparPor] = useState<AgruparGastosPor>('imovel')
  const [gerando, setGerando] = useState(false)

  const periodo = atalho === 'escolher' ? personalizado : periodoDoAtalho(atalho)
  const periodoValido = Boolean(periodo.inicio && periodo.fim && periodo.inicio <= periodo.fim)
  const financeiro = useRelatorioFinanceiro(periodo, periodoValido)
  const gastos = useRelatorioGastos({ ...periodo, agruparPor }, periodoValido)
  // Enquanto o período novo carrega, a tela mostra o anterior: o PDF só sai com os dados do período escolhido.
  const prontos =
    periodoValido &&
    financeiro.isSuccess &&
    gastos.isSuccess &&
    !financeiro.isPlaceholderData &&
    !gastos.isPlaceholderData

  async function gerarPdf() {
    if (!financeiro.data || !gastos.data) return
    setGerando(true)
    try {
      const { baixarRelatorioPdf } = await import('@/lib/relatorioPdf')
      await baixarRelatorioPdf({ periodo, financeiro: financeiro.data, gastos: gastos.data })
      toast.success('PDF do relatório gerado.')
    } catch {
      toast.error('Não foi possível gerar o PDF. Tente de novo.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <Pagina
      titulo="Relatório de gastos"
      larga
      acoes={
        <Button variant="secondary" onClick={gerarPdf} disabled={!prontos || gerando}>
          <FilePdfIcon weight="bold" aria-hidden />
          {gerando ? 'Gerando…' : 'Gerar PDF'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 rounded-2xl bg-folha p-4 shadow-folha sm:grid-cols-3">
          <Selecao rotulo="Período" value={atalho} onChange={(e) => setAtalho(e.target.value as Atalho)}>
            <option value="este-mes">Este mês</option>
            <option value="mes-passado">Mês passado</option>
            <option value="este-ano">Este ano</option>
            <option value="escolher">Escolher datas</option>
          </Selecao>
          {atalho === 'escolher' ? (
            <>
              <Campo
                rotulo="De"
                type="date"
                value={personalizado.inicio}
                onChange={(e) => setPersonalizado((p) => ({ ...p, inicio: e.target.value }))}
              />
              <Campo
                rotulo="Até"
                type="date"
                value={personalizado.fim}
                erro={periodoValido ? undefined : 'A data final precisa ser igual ou depois da inicial.'}
                onChange={(e) => setPersonalizado((p) => ({ ...p, fim: e.target.value }))}
              />
            </>
          ) : (
            <p className="text-base text-muted-foreground sm:col-span-2 sm:self-end sm:pb-3">
              De {dataCurta(periodo.inicio)} a {dataCurta(periodo.fim)}
            </p>
          )}
        </div>

        {periodoValido && (
          <Abas<AbaRelatorio>
            rotulo="Partes do relatório"
            abas={[
              {
                valor: 'balanco',
                rotulo: 'Balanço',
                icone: ScalesIcon,
                conteudo: <Carregado consulta={financeiro}>{(r) => <Balanco r={r} />}</Carregado>,
              },
              {
                valor: 'entradas',
                rotulo: 'Recebíveis e pessoais',
                icone: UsersThreeIcon,
                conteudo: <Carregado consulta={financeiro}>{(r) => <RecebiveisEPessoais r={r} />}</Carregado>,
              },
              {
                valor: 'gastos',
                rotulo: 'Por imóvel ou categoria',
                icone: ListBulletsIcon,
                conteudo: (
                  <div className="flex flex-col gap-5">
                    <div className="sm:max-w-sm">
                      <Opcoes<AgruparGastosPor>
                        rotulo="Separar por"
                        formato="segmentos"
                        valor={agruparPor}
                        aoMudar={setAgruparPor}
                        opcoes={[
                          { valor: 'imovel', rotulo: 'Imóvel' },
                          { valor: 'categoria', rotulo: 'Categoria' },
                        ]}
                      />
                    </div>
                    <Carregado consulta={gastos}>{(g) => <Resultado relatorio={g} />}</Carregado>
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>
    </Pagina>
  )
}

/** Carregando, erro ou o conteúdo desenhado com os dados. */
function Carregado<T>({ consulta, children }: { consulta: Consulta<T>; children: (dados: T) => ReactNode }) {
  if (consulta.isPending)
    return (
      <div role="status" aria-label="Carregando relatório" className="flex flex-col gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    )
  if (consulta.isError || consulta.data === undefined)
    return (
      <EstadoVazio
        icone={ChartBarIcon}
        titulo="Não foi possível carregar o relatório"
        acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
      />
    )
  return children(consulta.data)
}

/** Uma linha "rótulo ... valor" com a nota do critério embaixo. */
function Linha({ rotulo, valor, nota, cor }: { rotulo: string; valor: number; nota?: string; cor?: string }) {
  return (
    <div className="flex flex-col py-2">
      <div className="flex items-baseline justify-between gap-3">
        <dt>{rotulo}</dt>
        <dd className={cn('font-bold tabular-nums', cor)}>{formatarCentavos(valor)}</dd>
      </div>
      {nota && <p className="text-sm text-muted-foreground">{nota}</p>}
    </div>
  )
}

/** Cartão branco com título, um por grupo de números. */
function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = `cartao-${titulo.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 rounded-2xl bg-folha p-4 shadow-folha md:p-5">
      <h2 id={id} className="text-xl font-bold">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

/**
 * Entradas (recebíveis), saídas (contas) e saldo do período, com o critério de cada número escrito:
 * previsto pela data prevista/vencimento, realizado pela data do recebimento/pagamento.
 */
function Balanco({ r }: { r: RelatorioFinanceiro }) {
  const { entradas: e, saidas: s, saldo } = r
  return (
    <div className="flex flex-col gap-5">
      <div className="grid items-start gap-5 md:grid-cols-2">
        <Cartao titulo="Entradas (recebíveis)">
          <dl className="flex flex-col divide-y divide-linha">
            <Linha rotulo="Previsto" valor={e.totalCentavos} nota="Com data prevista no período" />
            <Linha rotulo="Já recebido" valor={e.recebidoCentavos} cor="text-ok" />
            <Linha
              rotulo="A receber"
              valor={e.pendenteCentavos}
              nota={e.vencidoCentavos > 0 ? `${formatarCentavos(e.vencidoCentavos)} atrasados` : undefined}
              cor={e.vencidoCentavos > 0 ? 'text-atraso' : 'text-alerta'}
            />
            <Linha rotulo="Recebido no período" valor={e.recebidoNoPeriodoCentavos} nota="Pela data do recebimento" />
          </dl>
        </Cartao>
        <Cartao titulo="Saídas (contas)">
          <dl className="flex flex-col divide-y divide-linha">
            <Linha rotulo="Contas do período" valor={s.totalCentavos} nota="Com vencimento no período" />
            <Linha rotulo="Já pago" valor={s.pagoCentavos} cor="text-ok" />
            <Linha
              rotulo="A pagar"
              valor={s.pendenteCentavos}
              nota={s.vencidoCentavos > 0 ? `${formatarCentavos(s.vencidoCentavos)} vencidos` : undefined}
              cor={s.vencidoCentavos > 0 ? 'text-atraso' : 'text-alerta'}
            />
            <Linha rotulo="Pago no período" valor={s.pagoNoPeriodoCentavos} nota="Pela data do pagamento" />
          </dl>
        </Cartao>
      </div>
      <Cartao titulo="Saldo do período">
        <dl className="grid gap-x-6 md:grid-cols-2">
          <Linha
            rotulo="Saldo realizado"
            valor={saldo.realizadoCentavos}
            nota="Recebido no período − pago no período"
            cor={saldo.realizadoCentavos < 0 ? 'text-atraso' : 'text-ok'}
          />
          <Linha
            rotulo="Saldo projetado"
            valor={saldo.projetadoCentavos}
            nota="Recebíveis previstos − contas do período"
            cor={saldo.projetadoCentavos < 0 ? 'text-atraso' : 'text-ok'}
          />
        </dl>
      </Cartao>
    </div>
  )
}

/** Recebíveis por origem e as despesas pessoais (sem imóvel), lado a lado no computador. */
function RecebiveisEPessoais({ r }: { r: RelatorioFinanceiro }) {
  const { entradas: e, pessoal } = r
  return (
    <div className="grid items-start gap-5 md:grid-cols-2">
      <Cartao titulo="Recebíveis por origem">
        {e.porOrigem.length === 0 ? (
          <p className="text-muted-foreground">Nenhum recebível no período.</p>
        ) : (
          <dl className="flex flex-col divide-y divide-linha">
            {e.porOrigem.map((o) => (
              <Linha
                key={o.origem}
                rotulo={ORIGENS[o.origem]}
                valor={o.totalCentavos}
                nota={`Recebido ${formatarCentavos(o.recebidoCentavos)} · a receber ${formatarCentavos(o.pendenteCentavos)}`}
              />
            ))}
          </dl>
        )}
      </Cartao>
      <Cartao titulo="Despesas pessoais (sem imóvel)">
        <dl className="flex flex-col divide-y divide-linha">
          <Linha rotulo="Total" valor={pessoal.totalCentavos} />
          <Linha rotulo="Pago" valor={pessoal.pagoCentavos} cor="text-ok" />
          <Linha rotulo="A pagar" valor={pessoal.pendenteCentavos} />
        </dl>
        {pessoal.categorias.length > 0 && (
          <>
            <h3 className="pt-3 text-base font-bold text-muted-foreground">Por categoria</h3>
            <dl className="flex flex-col divide-y divide-linha">
              {pessoal.categorias.map((c) => (
                <Linha key={c.id ?? c.nome} rotulo={c.nome} valor={c.totalCentavos} />
              ))}
            </dl>
          </>
        )}
      </Cartao>
    </div>
  )
}

function Resultado({ relatorio }: { relatorio: RelatorioGastos }) {
  const { inicio, fim, itens, totalPagoCentavos, totalPrevistoCentavos } = relatorio

  if (itens.length === 0) {
    return (
      <EstadoVazio icone={ChartBarIcon} titulo="Nada pago ou previsto neste período">
        De {dataCurta(inicio)} a {dataCurta(fim)} não há pagamentos. Experimente outro período.
      </EstadoVazio>
    )
  }

  // Uma escala só para as duas séries, para as barras serem comparáveis entre si.
  const maximo = Math.max(...itens.flatMap((i) => [i.pagoCentavos, i.previstoCentavos]), 1)

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3">
        <div className="min-w-0 rounded-2xl bg-folha p-4 shadow-folha">
          <dt className="flex items-center gap-2 text-base text-muted-foreground">
            <span aria-hidden className="size-3 rounded-sm bg-serie-pago" />
            Pago
          </dt>
          <dd className="text-xl font-bold tabular-nums sm:text-2xl">{formatarCentavos(totalPagoCentavos)}</dd>
        </div>
        <div className="min-w-0 rounded-2xl bg-folha p-4 shadow-folha">
          <dt className="flex items-center gap-2 text-base text-muted-foreground">
            <span aria-hidden className="size-3 rounded-sm bg-serie-previsto" />
            Previsto
          </dt>
          <dd className="text-xl font-bold tabular-nums sm:text-2xl">{formatarCentavos(totalPrevistoCentavos)}</dd>
        </div>
      </dl>

      <section className="rounded-2xl bg-folha p-4 shadow-folha md:p-5" aria-labelledby="titulo-grafico">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="titulo-grafico" className="text-xl font-bold">
            {relatorio.agruparPor === 'imovel' ? 'Por imóvel' : 'Por categoria'}
          </h2>
          <p className="text-base text-muted-foreground">
            {dataCurta(inicio)} a {dataCurta(fim)}
          </p>
        </div>
        <p className="mb-4 max-w-prose text-base text-muted-foreground">
          Pago: contas pagas no período. Previsto: contas que vencem no período e ainda não foram pagas.
        </p>
        {/* Lista semântica: cada grupo diz os dois valores em texto; a barra só reforça. Duas colunas no computador. */}
        <ul className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
          {itens.map((item) => (
            <li key={item.id ?? item.nome} className="flex flex-col gap-2">
              <span className="text-lg font-bold">{item.nome}</span>
              <Barra rotulo="Pago" centavos={item.pagoCentavos} maximo={maximo} cor="bg-serie-pago" />
              <Barra rotulo="Previsto" centavos={item.previstoCentavos} maximo={maximo} cor="bg-serie-previsto" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Barra({ rotulo, centavos, maximo, cor }: { rotulo: string; centavos: number; maximo: number; cor: string }) {
  const largura = centavos === 0 ? 0 : Math.max((centavos / maximo) * 100, 1.5)
  return (
    <div className="flex flex-col gap-1 text-base">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className="font-semibold tabular-nums">{formatarCentavos(centavos)}</span>
      </div>
      {/* Trilho cinza claro mostra a escala inteira; a barra parte sempre da esquerda. */}
      <div className="h-3 rounded-r-[4px] bg-muted">
        <div className={`h-full rounded-r-[4px] ${cor}`} style={{ width: `${largura}%` }} />
      </div>
    </div>
  )
}
