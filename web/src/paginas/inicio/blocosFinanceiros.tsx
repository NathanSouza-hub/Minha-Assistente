import {
  BuildingsIcon,
  HandCoinsIcon,
  ReceiptIcon,
  UserIcon,
  WalletIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { Link } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { usePagamentos } from '@/consultas/pagamentos'
import { useRecebiveis } from '@/consultas/recebiveis'
import { dataCurta, descreverVencimento, hojeISO, nomeDoMes, somarDias } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Pagamento, RelatorioFinanceiro } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { BarraPago, PagoPendente, SituacaoContas } from '@/components/ResumoValores'
import { IMOVEL_PESSOAL } from '@/paginas/pagamentos/filtros'
import { ORIGENS } from '@/paginas/recebiveis/formulario'
import { Bloco, Vazio } from './Bloco'

type Financeiro = UseQueryResult<RelatorioFinanceiro>

const despesasDoMes = (mes: string, extra = '') => `/despesas?mes=${mes}${extra}`

/** Um número do painel: rótulo, valor e uma linha explicando de onde ele vem. */
function Indicador({ rotulo, valor, nota, cor }: { rotulo: string; valor: number; nota: string; cor?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-suave/70 px-3 py-2.5 sm:px-4 sm:py-3">
      <dt className="text-base font-semibold text-muted-foreground">{rotulo}</dt>
      <dd className={cn('text-lg leading-tight font-[750] tabular-nums sm:text-2xl', cor)}>{formatarCentavos(valor)}</dd>
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
        const { saidas: s, entradas: e, saldo } = consulta.data!
        return (
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-muted-foreground">Despesas</h3>
            <dl className="-mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
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
            <h3 className="text-base font-bold text-muted-foreground">Recebíveis</h3>
            <dl className="-mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Indicador rotulo="Previsto a receber" valor={e.totalCentavos} nota={`Previstos para ${nomeMes}`} />
              <Indicador rotulo="Já recebido" valor={e.recebidoCentavos} nota="Desses recebíveis" cor="text-ok" />
              <Indicador
                rotulo="A receber"
                valor={e.pendenteCentavos}
                nota={e.vencidoCentavos > 0 ? `${formatarCentavos(e.vencidoCentavos)} atrasados` : 'Nenhum atrasado'}
                cor={e.vencidoCentavos > 0 ? 'text-atraso' : 'text-alerta'}
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

/** Um cartão por imóvel, com os totais calculados das contas dele no mês. */
export function BlocoResidencias({ consulta }: { consulta: Financeiro }) {
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
                  to={`/imoveis/${i.id}`}
                  className="flex h-full flex-col gap-3 rounded-xl border border-linha p-4 hover:border-primary/40 hover:bg-suave/40"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-lg leading-snug font-bold">{i.nome}</span>
                    <span className="shrink-0 text-lg font-bold tabular-nums">{formatarCentavos(i.totalCentavos)}</span>
                  </span>
                  <BarraPago v={i} />
                  <PagoPendente v={i} />
                  <SituacaoContas v={i} />
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

const QUANTOS_RECEBIVEIS = 5

/**
 * O que ainda falta receber até 30 dias à frente (os atrasados primeiro, pela data prevista) e o
 * resumo do mês por origem.
 */
export function BlocoRecebiveis({ consulta: financeiro, mes }: { consulta: Financeiro; mes: string }) {
  const consulta = useRecebiveis({ fim: somarDias(hojeISO(), 30) })
  return (
    <Bloco
      titulo="Recebíveis"
      icone={HandCoinsIcon}
      area="recebiveis"
      link={{ para: `/recebiveis?mes=${mes}`, rotulo: 'Ver todos' }}
      consulta={consulta}
    >
      {() => {
        const abertos = consulta.data!.filter((r) => r.status !== 'recebido')
        const porOrigem = financeiro.data?.entradas.porOrigem ?? []
        return (
          <div className="flex flex-col gap-3">
            {porOrigem.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Previsto no mês por origem">
                {porOrigem.map((o) => (
                  <li key={o.origem} className="rounded-full bg-area-fundo px-3 py-1 text-base font-semibold text-area">
                    {ORIGENS[o.origem]} {formatarCentavos(o.totalCentavos)}
                  </li>
                ))}
              </ul>
            )}
            {abertos.length === 0 ? (
              <Vazio>Nada a receber nos próximos 30 dias.</Vazio>
            ) : (
              <ul className="flex flex-col divide-y divide-linha">
                {abertos.slice(0, QUANTOS_RECEBIVEIS).map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/recebiveis/${r.id}`}
                      className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-suave/60"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold">{r.descricao}</span>
                        <span className="text-base text-muted-foreground">
                          {ORIGENS[r.origem]}
                          {r.status === 'parcial' && ` · recebido ${formatarCentavos(r.recebidoCentavos)}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="font-bold tabular-nums">{formatarCentavos(r.saldoCentavos)}</span>
                        <span
                          className={cn(
                            'flex items-center gap-1 text-base',
                            r.atrasado ? 'font-semibold text-atraso' : 'text-muted-foreground',
                          )}
                        >
                          {r.atrasado && <WarningCircleIcon className="size-4" weight="fill" aria-hidden />}
                          {r.atrasado ? `Atrasado (${dataCurta(r.dataPrevista)})` : `Previsto ${dataCurta(r.dataPrevista)}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
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
