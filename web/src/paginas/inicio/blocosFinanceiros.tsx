import { BuildingsIcon, CheckCircleIcon, ClockIcon, ReceiptIcon, UserIcon, WalletIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { usePagamentos } from '@/consultas/pagamentos'
import { descreverVencimento, hojeISO, nomeDoMes, somarDias } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Pagamento, RelatorioFinanceiro, ValoresContas } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { IMOVEL_PESSOAL } from '@/paginas/pagamentos/filtros'
import { Bloco, Vazio } from './Bloco'

type Financeiro = UseQueryResult<RelatorioFinanceiro>

const despesasDoMes = (mes: string, extra = '') => `/despesas?mes=${mes}${extra}`

/** Um número do painel: rótulo, valor e uma linha explicando de onde ele vem. */
function Indicador({ rotulo, valor, nota, cor }: { rotulo: string; valor: number; nota: string; cor?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-suave/70 px-4 py-3">
      <dt className="text-base font-semibold text-muted-foreground">{rotulo}</dt>
      <dd className={cn('text-2xl leading-tight font-[750] tabular-nums', cor)}>{formatarCentavos(valor)}</dd>
      <dd className="text-sm text-muted-foreground">{nota}</dd>
    </div>
  )
}

/**
 * Indicadores do mês. Previsto e realizado ficam separados e com o critério escrito: as contas do
 * mês são as que vencem nele; "pago no mês" é pela data em que foram pagas.
 */
export function BlocoFinancas({ consulta, mes }: { consulta: Financeiro; mes: string }) {
  const nomeMes = nomeDoMes(mes).split(' ')[0].toLowerCase()
  return (
    <Bloco
      titulo="Finanças do mês"
      icone={WalletIcon}
      area="contas"
      link={{ para: despesasDoMes(mes), rotulo: 'Despesas' }}
      consulta={consulta}
      className="lg:col-span-2"
    >
      {() => {
        const s = consulta.data!.saidas
        return (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
              <Indicador rotulo="Despesas do mês" valor={s.totalCentavos} nota={`Contas que vencem em ${nomeMes}`} />
              <Indicador rotulo="Já pago" valor={s.pagoCentavos} nota="Dessas contas" cor="text-ok" />
              <Indicador
                rotulo="A pagar"
                valor={s.pendenteCentavos}
                nota={s.vencidoCentavos > 0 ? `${formatarCentavos(s.vencidoCentavos)} vencidos` : 'Nenhuma vencida'}
                cor={s.vencidoCentavos > 0 ? 'text-atraso' : 'text-alerta'}
              />
              <Indicador rotulo="Pago no mês" valor={s.pagoNoPeriodoCentavos} nota="Pela data do pagamento" />
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

/** Situação de um conjunto de contas, sempre com texto e ícone além da cor. */
function Situacao({ v }: { v: ValoresContas }) {
  if (v.vencidoCentavos > 0)
    return (
      <span className="flex items-center gap-1.5 font-semibold text-atraso">
        <WarningCircleIcon className="size-5" weight="fill" aria-hidden />
        Conta vencida
      </span>
    )
  if (v.pendenteCentavos > 0)
    return (
      <span className="flex items-center gap-1.5 font-semibold text-alerta">
        <ClockIcon className="size-5" weight="fill" aria-hidden />
        Contas a pagar
      </span>
    )
  if (v.totalCentavos > 0)
    return (
      <span className="flex items-center gap-1.5 font-semibold text-ok">
        <CheckCircleIcon className="size-5" weight="fill" aria-hidden />
        Tudo pago
      </span>
    )
  return <span className="text-muted-foreground">Sem contas no mês</span>
}

/** Barra de quanto do total já foi pago. */
function BarraPago({ v }: { v: ValoresContas }) {
  const parte = v.totalCentavos > 0 ? Math.round((v.pagoCentavos / v.totalCentavos) * 100) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-suave" aria-hidden>
      <div className="h-full rounded-full bg-ok" style={{ width: `${parte}%` }} />
    </div>
  )
}

/** Pago e pendente lado a lado. */
function PagoPendente({ v }: { v: ValoresContas }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-base">
      <div>
        <dt className="text-muted-foreground">Pago</dt>
        <dd className="font-bold text-ok tabular-nums">{formatarCentavos(v.pagoCentavos)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">A pagar</dt>
        <dd className="font-bold tabular-nums">{formatarCentavos(v.pendenteCentavos)}</dd>
      </div>
    </dl>
  )
}

/** Um cartão por imóvel, com os totais calculados das contas dele no mês. */
export function BlocoResidencias({ consulta, mes }: { consulta: Financeiro; mes: string }) {
  return (
    <Bloco
      titulo="Residências"
      icone={BuildingsIcon}
      area="contas"
      link={{ para: '/imoveis', rotulo: 'Imóveis' }}
      consulta={consulta}
      className="lg:col-span-2"
    >
      {() => {
        const imoveis = consulta.data!.imoveis
        if (imoveis.length === 0)
          return (
            <Vazio>
              Nenhum imóvel cadastrado.{' '}
              <Link to="/imoveis" className="font-semibold text-primary underline">
                Cadastrar imóvel
              </Link>
            </Vazio>
          )
        return (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {imoveis.map((i) => (
              <li key={i.id}>
                <Link
                  to={despesasDoMes(mes, `&imovel=${i.id}`)}
                  className="flex h-full flex-col gap-3 rounded-xl border border-linha p-4 hover:border-primary/40 hover:bg-suave/40"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-lg leading-snug font-bold">{i.nome}</span>
                    <span className="shrink-0 text-lg font-bold tabular-nums">{formatarCentavos(i.totalCentavos)}</span>
                  </span>
                  <BarraPago v={i} />
                  <PagoPendente v={i} />
                  <Situacao v={i} />
                </Link>
              </li>
            ))}
          </ul>
        )
      }}
    </Bloco>
  )
}

/** Despesas sem imóvel: totais e a distribuição por categoria. */
export function BlocoPessoais({ consulta, mes }: { consulta: Financeiro; mes: string }) {
  return (
    <Bloco
      titulo="Despesas pessoais"
      icone={UserIcon}
      area="contas"
      link={{ para: despesasDoMes(mes, `&imovel=${IMOVEL_PESSOAL}`), rotulo: 'Ver lista' }}
      consulta={consulta}
    >
      {() => {
        const p = consulta.data!.pessoal
        if (p.categorias.length === 0) return <Vazio>Nenhuma despesa pessoal neste mês.</Vazio>
        const maior = Math.max(...p.categorias.map((c) => c.totalCentavos), 1)
        return (
          <div className="flex flex-col gap-4">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Total do mês</span>
              <span className="text-2xl font-[750] tabular-nums">{formatarCentavos(p.totalCentavos)}</span>
            </p>
            <BarraPago v={p} />
            <PagoPendente v={p} />
            <ul className="flex flex-col gap-2.5" aria-label="Por categoria">
              {p.categorias.map((c) => (
                <li key={c.id ?? c.nome} className="flex flex-col gap-1">
                  <span className="flex justify-between gap-3 text-base">
                    <span>{c.nome}</span>
                    <span className="font-semibold tabular-nums">{formatarCentavos(c.totalCentavos)}</span>
                  </span>
                  <div className="h-2 rounded-full bg-suave" aria-hidden>
                    <div
                      className="h-full rounded-full bg-area"
                      style={{ width: `${Math.round((c.totalCentavos / maior) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      }}
    </Bloco>
  )
}

const QUANTAS_CONTAS = 5

/** A fatura do cartão abre na aba Cartões, no mês dela; as outras contas, no formulário. */
const enderecoConta = (p: Pagamento) =>
  p.cartaoId ? `/pagamentos?aba=cartoes&cartao=${p.cartaoId}&mes=${p.competencia!.slice(0, 7)}` : `/pagamentos/${p.id}`

/** Próximas contas pendentes (as vencidas primeiro, pela ordem de vencimento) até 30 dias à frente. */
export function BlocoContasPendentes() {
  const consulta = usePagamentos({ status: 'pendente', fim: somarDias(hojeISO(), 30) })
  return (
    <Bloco
      titulo="Contas a pagar"
      icone={ReceiptIcon}
      area="contas"
      link={{ para: '/despesas?status=pendente', rotulo: 'Ver todas' }}
      consulta={consulta}
    >
      {() => {
        const contas = consulta.data!
        if (contas.length === 0) return <Vazio>Nenhuma conta a pagar nos próximos 30 dias.</Vazio>
        const restantes = contas.length - QUANTAS_CONTAS
        return (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y divide-linha">
              {contas.slice(0, QUANTAS_CONTAS).map((p) => (
                <li key={p.id}>
                  <Link
                    to={enderecoConta(p)}
                    className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-suave/60"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-bold">{p.descricao}</span>
                      <span className="text-base text-muted-foreground">{p.imovelNome ?? 'Pessoal'}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      {p.valorCentavos === null ? (
                        <span className="rounded-full bg-alerta-fundo px-2.5 font-semibold text-alerta">A definir</span>
                      ) : (
                        <span className="font-bold tabular-nums">{formatarCentavos(p.valorCentavos)}</span>
                      )}
                      <span
                        className={cn(
                          'flex items-center gap-1 text-base',
                          p.vencido ? 'font-semibold text-atraso' : 'text-muted-foreground',
                        )}
                      >
                        {p.vencido && <WarningCircleIcon className="size-4" weight="fill" aria-hidden />}
                        {descreverVencimento(p.vencimento)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {restantes > 0 && (
              <p className="text-base text-muted-foreground">
                E mais {restantes === 1 ? '1 conta' : `${restantes} contas`} nos próximos 30 dias.
              </p>
            )}
          </div>
        )
      }}
    </Bloco>
  )
}
