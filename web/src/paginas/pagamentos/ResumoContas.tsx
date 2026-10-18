import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { nomeDoMes, somarMeses } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Pagamento } from '@/lib/tipos'

/** ‹ Outubro de 2026 › — mês no formato "AAAA-MM". */
export function NavegadorMes({ mes, aoMudar }: { mes: string; aoMudar: (mes: string) => void }) {
  return (
    <nav aria-label="Mês" className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="icon" onClick={() => aoMudar(somarMeses(mes, -1))} aria-label="Mês anterior">
        <CaretLeftIcon className="size-7" weight="bold" aria-hidden />
      </Button>
      <h2 className="text-xl font-bold" aria-live="polite">
        {nomeDoMes(mes)}
      </h2>
      <Button variant="ghost" size="icon" onClick={() => aoMudar(somarMeses(mes, 1))} aria-label="Próximo mês">
        <CaretRightIcon className="size-7" weight="bold" aria-hidden />
      </Button>
    </nav>
  )
}

// Conta com valor a definir (equipe) não soma: aparece à parte, como "+ 2 a definir".
const soma = (lista: Pagamento[]) => lista.reduce((total, p) => total + (p.valorCentavos ?? 0), 0)

/** "A pagar" (com vencidas e a definir) e "Pago" das contas da lista. */
export function ResumoContas({ pagamentos }: { pagamentos: Pagamento[] }) {
  const aPagar = pagamentos.filter((p) => p.status === 'pendente')
  const vencidos = aPagar.filter((p) => p.vencido).length
  const aDefinir = aPagar.filter((p) => p.valorCentavos === null).length

  return (
    <dl className="grid grid-cols-2 gap-3">
      <div className="min-w-0 rounded-2xl bg-folha p-4 shadow-folha">
        <dt className="text-base text-muted-foreground">A pagar</dt>
        <dd className="text-xl font-bold tabular-nums sm:text-2xl">{formatarCentavos(soma(aPagar))}</dd>
        {aDefinir > 0 && <dd className="font-semibold">+ {aDefinir} a definir</dd>}
        {vencidos > 0 && (
          <dd className="font-semibold text-atraso">
            {vencidos === 1 ? '1 conta vencida' : `${vencidos} contas vencidas`}
          </dd>
        )}
      </div>
      <div className="min-w-0 rounded-2xl bg-folha p-4 shadow-folha">
        <dt className="text-base text-muted-foreground">Pago</dt>
        <dd className="text-xl font-bold text-ok tabular-nums sm:text-2xl">
          {formatarCentavos(soma(pagamentos.filter((p) => p.status === 'pago')))}
        </dd>
      </div>
    </dl>
  )
}
