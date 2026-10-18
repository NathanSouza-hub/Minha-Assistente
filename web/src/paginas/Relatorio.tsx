import { useState } from 'react'
import { ChartBarIcon } from '@phosphor-icons/react'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRelatorioGastos } from '@/consultas/pagamentos'
import { agora, dataCurta, intervaloDoMes, mesDe, somarMeses } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { AgruparGastosPor, RelatorioGastos } from '@/lib/tipos'

type Atalho = 'este-mes' | 'mes-passado' | 'este-ano' | 'escolher'

function periodoDoAtalho(atalho: Exclude<Atalho, 'escolher'>) {
  if (atalho === 'este-mes') return intervaloDoMes(mesDe())
  if (atalho === 'mes-passado') return intervaloDoMes(somarMeses(mesDe(), -1))
  const ano = agora().year
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` }
}

export function Relatorio() {
  const [atalho, setAtalho] = useState<Atalho>('este-mes')
  const [personalizado, setPersonalizado] = useState(periodoDoAtalho('este-mes'))
  const [agruparPor, setAgruparPor] = useState<AgruparGastosPor>('imovel')

  const periodo = atalho === 'escolher' ? personalizado : periodoDoAtalho(atalho)
  const periodoValido = Boolean(periodo.inicio && periodo.fim && periodo.inicio <= periodo.fim)
  const consulta = useRelatorioGastos({ ...periodo, agruparPor })

  return (
    <Pagina titulo="Relatório de gastos">
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 rounded-2xl bg-folha p-4 shadow-folha sm:grid-cols-2">
          <Selecao rotulo="Período" value={atalho} onChange={(e) => setAtalho(e.target.value as Atalho)}>
            <option value="este-mes">Este mês</option>
            <option value="mes-passado">Mês passado</option>
            <option value="este-ano">Este ano</option>
            <option value="escolher">Escolher datas</option>
          </Selecao>
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
          {atalho === 'escolher' && (
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
          )}
        </div>

        {!periodoValido ? null : consulta.isPending ? (
          <div role="status" aria-label="Carregando relatório" className="flex flex-col gap-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-64" />
          </div>
        ) : consulta.isError ? (
          <EstadoVazio
            icone={ChartBarIcon}
            titulo="Não foi possível carregar o relatório"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          />
        ) : (
          <Resultado relatorio={consulta.data} />
        )}
      </div>
    </Pagina>
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
    <div className="flex flex-col gap-6">
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

      <section className="rounded-2xl bg-folha p-4 shadow-folha" aria-labelledby="titulo-grafico">
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
        {/* Lista semântica: cada grupo diz os dois valores em texto; a barra só reforça. */}
        <ul className="flex flex-col gap-5">
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
