import { WarningCircleIcon } from '@phosphor-icons/react'
import { Lista } from '@/components/Linha'
import { hojeISO } from '@/lib/datas'
import type { Pagamento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { ItemPagamento } from './ItemPagamento'

/**
 * As contas do mês por urgência: vencidas em cima (vermelho), as que vencem hoje, as próximas e, no
 * fim, as pagas. Cada grupo é uma lista de `ItemPagamento` (círculo para pagar, como no Início).
 */
export function ContasPorUrgencia({ pagamentos, rotulo }: { pagamentos: Pagamento[]; rotulo: string }) {
  const hoje = hojeISO()
  const pendentes = pagamentos.filter((p) => p.status === 'pendente')
  const grupos = [
    { id: 'vencidas', titulo: 'Vencidas', contas: pendentes.filter((p) => p.vencido) },
    { id: 'hoje', titulo: 'Vencem hoje', contas: pendentes.filter((p) => !p.vencido && p.vencimento === hoje) },
    { id: 'proximas', titulo: 'Próximas', contas: pendentes.filter((p) => !p.vencido && p.vencimento !== hoje) },
    { id: 'pagas', titulo: 'Pagas', contas: pagamentos.filter((p) => p.status === 'pago') },
  ].filter((g) => g.contas.length > 0)

  return (
    <section aria-label={rotulo} className="flex flex-col gap-6">
      {grupos.map(({ id, titulo, contas }) => (
        <div key={id} className="flex flex-col gap-2">
          <h2
            id={`contas-${id}`}
            className={cn(
              'flex items-center gap-1.5 text-[1.18rem] font-bold tracking-[-0.015em]',
              id === 'vencidas' && 'text-base text-atraso',
            )}
          >
            {id === 'vencidas' && <WarningCircleIcon weight="bold" className="size-5" aria-hidden />}
            {titulo}
          </h2>
          <Lista rotulo={titulo}>
            {contas.map((p) => (
              <ItemPagamento key={p.id} pagamento={p} />
            ))}
          </Lista>
        </div>
      ))}
    </section>
  )
}
