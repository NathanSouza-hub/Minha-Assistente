import type { ReactNode } from 'react'
import { CaretRightIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { SeloEstado } from '@/components/Estado'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { nomeDoMes } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { RelatorioFinanceiro } from '@/lib/tipos'
import { cn } from '@/lib/utils'

type Financeiro = UseQueryResult<RelatorioFinanceiro>

/**
 * Uma linha do painel: rótulo e, embaixo, de onde o número vem; o valor à direita. Com `para`, a
 * linha inteira leva à lista daquelas contas (só quando a lista usa o mesmo critério do número).
 * O valor vem logo depois do rótulo no HTML (a grade é que põe a nota embaixo do rótulo).
 */
function Indicador({
  rotulo,
  valor,
  nota,
  cor,
  para,
}: {
  rotulo: string
  valor: number
  nota: ReactNode
  cor?: string
  para?: string
}) {
  const conteudo = (
    <>
      <dt className="col-start-1 row-start-1 font-semibold">{rotulo}</dt>
      <dd className={cn('col-start-2 row-span-2 row-start-1 self-center text-right text-lg font-bold tabular-nums', cor)}>
        {formatarCentavos(valor)}
      </dd>
      <dd className="col-start-1 row-start-2 text-[0.88rem] text-muted-foreground">{nota}</dd>
      {para && (
        <dd aria-hidden className="col-start-3 row-span-2 row-start-1 self-center text-muted-foreground">
          <CaretRightIcon weight="bold" className="size-4" />
        </dd>
      )}
    </>
  )
  const classe = 'grid grid-cols-[minmax(0,1fr)_auto_1rem] items-start gap-x-3 px-4 py-3'
  if (!para) return <div className={classe}>{conteudo}</div>
  return (
    <div>
      <Link to={para} className={cn(classe, 'hover:bg-suave/60')}>
        {conteudo}
      </Link>
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[1.18rem] font-bold tracking-[-0.015em]">{titulo}</h3>
      <dl className="superficie flex flex-col divide-y divide-linha overflow-hidden">{children}</dl>
    </div>
  )
}

/**
 * Indicadores do mês — a Visão geral só tem eles; o detalhe fica na tela de cada área. Previsto e
 * realizado ficam separados e com o critério escrito: as contas do mês são as que vencem nele;
 * "pago no mês" é pela data em que foram pagas (esse e os saldos não têm lista equivalente).
 * Cor só no que pede atenção: o que já foi pago/recebido, o vencido e saldo negativo.
 */
export function BlocoFinancas({ consulta, mes }: { consulta: Financeiro; mes: string }) {
  const nomeMes = nomeDoMes(mes).split(' ')[0].toLowerCase()
  const despesas = `/despesas?mes=${mes}`
  // A lista de recebíveis separa "parcial" de "pendente"; por isso os três levam à lista do mês inteira.
  const recebiveis = `/recebiveis?mes=${mes}`
  return (
    <section aria-labelledby="bloco-financas" className="area-contas">
      <h2 id="bloco-financas" className="sr-only">
        Finanças do mês
      </h2>
      {consulta.isPending ? (
        <div role="status" aria-label="Carregando finanças do mês" className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : consulta.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">Não foi possível carregar. Verifique a internet.</p>
          <Button variant="outline" size="sm" onClick={() => consulta.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <Indicadores dados={consulta.data} nomeMes={nomeMes} despesas={despesas} recebiveis={recebiveis} />
      )}
    </section>
  )
}

function Indicadores({
  dados: { saidas: s, entradas: e, saldo },
  nomeMes,
  despesas,
  recebiveis,
}: {
  dados: RelatorioFinanceiro
  nomeMes: string
  despesas: string
  recebiveis: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 md:grid-cols-2">
        <Grupo titulo="Despesas">
          <Indicador rotulo="Despesas do mês" valor={s.totalCentavos} nota={`Contas que vencem em ${nomeMes}`} para={despesas} />
          <Indicador rotulo="Já pago" valor={s.pagoCentavos} nota="Dessas contas" cor="text-ok" para={`${despesas}&status=pago`} />
          <Indicador
            rotulo="A pagar"
            valor={s.pendenteCentavos}
            nota={
              s.vencidoCentavos > 0 ? (
                <SeloEstado estado="vencido">{formatarCentavos(s.vencidoCentavos)} vencidos</SeloEstado>
              ) : (
                'Nenhuma vencida'
              )
            }
            para={`${despesas}&status=pendente`}
          />
          <Indicador rotulo="Pago no mês" valor={s.pagoNoPeriodoCentavos} nota="Pela data do pagamento" />
        </Grupo>
        <Grupo titulo="Recebíveis">
          <Indicador rotulo="Previsto a receber" valor={e.totalCentavos} nota={`Previstos para ${nomeMes}`} para={recebiveis} />
          <Indicador rotulo="Já recebido" valor={e.recebidoCentavos} nota="Desses recebíveis" cor="text-ok" para={recebiveis} />
          <Indicador
            rotulo="A receber"
            valor={e.pendenteCentavos}
            nota={
              e.vencidoCentavos > 0 ? (
                <SeloEstado estado="vencido">{formatarCentavos(e.vencidoCentavos)} atrasados</SeloEstado>
              ) : (
                'Nenhum atrasado'
              )
            }
            para={recebiveis}
          />
          <Indicador rotulo="Recebido no mês" valor={e.recebidoNoPeriodoCentavos} nota="Pela data do recebimento" />
        </Grupo>
        <Grupo titulo="Saldo do mês">
          <Indicador
            rotulo="Saldo realizado"
            valor={saldo.realizadoCentavos}
            nota="Recebido no mês − pago no mês"
            cor={saldo.realizadoCentavos < 0 ? 'text-atraso' : undefined}
          />
          <Indicador
            rotulo="Saldo projetado"
            valor={saldo.projetadoCentavos}
            nota="Previsto a receber − despesas do mês"
            cor={saldo.projetadoCentavos < 0 ? 'text-atraso' : undefined}
          />
        </Grupo>
      </div>
      {s.contasADefinir > 0 && (
        <p className="text-base">
          <SeloEstado estado="a_definir">
            {s.contasADefinir === 1
              ? '1 conta da equipe está com o valor a definir (fora dos totais).'
              : `${s.contasADefinir} contas da equipe estão com o valor a definir (fora dos totais).`}
          </SeloEstado>
        </p>
      )}
    </div>
  )
}
