import { SeloEstado } from '@/components/Estado'
import { formatarCentavos } from '@/lib/dinheiro'
import type { ValoresContas } from '@/lib/tipos'

/** Situação de um conjunto de contas, com os estados padronizados (texto e ícone além da cor). */
export function SituacaoContas({ v, vazio = 'Sem contas no mês' }: { v: ValoresContas; vazio?: string }) {
  if (v.vencidoCentavos > 0) return <SeloEstado estado="vencido">Conta vencida</SeloEstado>
  if (v.pendenteCentavos > 0) return <span>Contas a pagar</span>
  if (v.totalCentavos > 0) return <SeloEstado estado="feito">Tudo pago</SeloEstado>
  return <span>{vazio}</span>
}

/** Barra de quanto do total já foi pago. */
export function BarraPago({ v }: { v: Pick<ValoresContas, 'totalCentavos' | 'pagoCentavos'> }) {
  const parte = v.totalCentavos > 0 ? Math.round((v.pagoCentavos / v.totalCentavos) * 100) : 0
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-contorno/70" aria-hidden>
      <div className="h-full rounded-full bg-primary" style={{ width: `${parte}%` }} />
    </div>
  )
}

/** Pago e pendente lado a lado. */
export function PagoPendente({ v }: { v: ValoresContas }) {
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
