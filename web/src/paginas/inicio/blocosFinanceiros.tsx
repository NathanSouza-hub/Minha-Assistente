import { CaretRightIcon, WalletIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { Bloco } from '@/components/Bloco'
import { nomeDoMes } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { RelatorioFinanceiro } from '@/lib/tipos'
import { cn } from '@/lib/utils'

type Financeiro = UseQueryResult<RelatorioFinanceiro>

/**
 * Um número do painel: rótulo, valor e uma linha explicando de onde ele vem. Com `para`, o cartão
 * inteiro leva à lista daquelas contas (só quando a lista usa o mesmo critério do número).
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
  nota: string
  cor?: string
  para?: string
}) {
  const conteudo = (
    <>
      <dt className="flex items-center justify-between gap-1 text-base font-semibold text-muted-foreground">
        {rotulo}
        {para && <CaretRightIcon weight="bold" className="size-4 shrink-0 text-primary" aria-hidden />}
      </dt>
      <dd className={cn('text-lg leading-tight font-bold tabular-nums sm:text-2xl', cor)}>{formatarCentavos(valor)}</dd>
      <dd className="text-sm text-muted-foreground">{nota}</dd>
    </>
  )
  const classe = 'flex min-w-0 flex-col gap-0.5 rounded-xl bg-suave/70 px-3 py-2.5 sm:px-4 sm:py-3'
  if (!para) return <div className={classe}>{conteudo}</div>
  return (
    <div>
      <Link to={para} className={cn(classe, 'h-full hover:bg-suave')}>
        {conteudo}
      </Link>
    </div>
  )
}

/**
 * Indicadores do mês — a Visão geral só tem eles; o detalhe fica na tela de cada área. Previsto e
 * realizado ficam separados e com o critério escrito: as contas do mês são as que vencem nele;
 * "pago no mês" é pela data em que foram pagas (esse e os saldos não têm lista equivalente).
 */
export function BlocoFinancas({ consulta, mes }: { consulta: Financeiro; mes: string }) {
  const nomeMes = nomeDoMes(mes).split(' ')[0].toLowerCase()
  const despesas = `/despesas?mes=${mes}`
  // A lista de recebíveis separa "parcial" de "pendente"; por isso os três levam à lista do mês inteira.
  const recebiveis = `/recebiveis?mes=${mes}`
  return (
    <Bloco titulo="Finanças do mês" icone={WalletIcon} area="contas" consulta={consulta}>
      {() => {
        const { saidas: s, entradas: e, saldo } = consulta.data!
        return (
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-muted-foreground">Despesas</h3>
            <dl className="-mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Indicador
                rotulo="Despesas do mês"
                valor={s.totalCentavos}
                nota={`Contas que vencem em ${nomeMes}`}
                para={despesas}
              />
              <Indicador
                rotulo="Já pago"
                valor={s.pagoCentavos}
                nota="Dessas contas"
                cor="text-ok"
                para={`${despesas}&status=pago`}
              />
              <Indicador
                rotulo="A pagar"
                valor={s.pendenteCentavos}
                nota={s.vencidoCentavos > 0 ? `${formatarCentavos(s.vencidoCentavos)} vencidos` : 'Nenhuma vencida'}
                cor={s.vencidoCentavos > 0 ? 'text-atraso' : 'text-alerta'}
                para={`${despesas}&status=pendente`}
              />
              <Indicador rotulo="Pago no mês" valor={s.pagoNoPeriodoCentavos} nota="Pela data do pagamento" />
            </dl>
            <h3 className="text-base font-bold text-muted-foreground">Recebíveis</h3>
            <dl className="-mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Indicador
                rotulo="Previsto a receber"
                valor={e.totalCentavos}
                nota={`Previstos para ${nomeMes}`}
                para={recebiveis}
              />
              <Indicador
                rotulo="Já recebido"
                valor={e.recebidoCentavos}
                nota="Desses recebíveis"
                cor="text-ok"
                para={recebiveis}
              />
              <Indicador
                rotulo="A receber"
                valor={e.pendenteCentavos}
                nota={e.vencidoCentavos > 0 ? `${formatarCentavos(e.vencidoCentavos)} atrasados` : 'Nenhum atrasado'}
                cor={e.vencidoCentavos > 0 ? 'text-atraso' : 'text-alerta'}
                para={recebiveis}
              />
              <Indicador rotulo="Recebido no mês" valor={e.recebidoNoPeriodoCentavos} nota="Pela data do recebimento" />
            </dl>
            <h3 className="text-base font-bold text-muted-foreground">Saldo do mês</h3>
            <dl className="-mt-2 grid grid-cols-2 gap-2">
              <Indicador
                rotulo="Saldo realizado"
                valor={saldo.realizadoCentavos}
                nota="Recebido no mês − pago no mês"
                cor={saldo.realizadoCentavos < 0 ? 'text-atraso' : 'text-ok'}
              />
              <Indicador
                rotulo="Saldo projetado"
                valor={saldo.projetadoCentavos}
                nota="Previsto a receber − despesas do mês"
                cor={saldo.projetadoCentavos < 0 ? 'text-atraso' : 'text-ok'}
              />
            </dl>
            {s.contasADefinir > 0 && (
              <p className="text-base text-alerta">
                {s.contasADefinir === 1
                  ? '1 conta da equipe está com o valor a definir (fora dos totais).'
                  : `${s.contasADefinir} contas da equipe estão com o valor a definir (fora dos totais).`}
              </p>
            )}
          </div>
        )
      }}
    </Bloco>
  )
}
