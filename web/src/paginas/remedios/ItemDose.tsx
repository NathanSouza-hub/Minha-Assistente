import { ArrowCounterClockwiseIcon, CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useRegistrarDose } from '@/consultas/medicamentos'
import { horaDe } from '@/lib/datas'
import type { DoseDoDia } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/** Remédio à esquerda; "Tomei" / "Não tomei" (ou "Desfazer") à direita, ao alcance do polegar. */
export function ItemDose({ dose: d, futuro }: { dose: DoseDoDia; futuro: boolean }) {
  const registrar = useRegistrarDose(d.data)
  const marcar = (situacao: DoseDoDia['situacao']) => registrar.mutate({ horarioId: d.horarioId, situacao })
  const marcada = d.situacao !== 'pendente'

  return (
    <li className="flex items-center gap-3 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn('text-lg font-bold', marcada && 'text-muted-foreground')}>
          {d.nome}
          {d.hora && <span className="ml-2 font-semibold text-muted-foreground tabular-nums">{d.hora}</span>}
        </p>
        {d.dose && <p className="text-base">{d.dose}</p>}
        {d.observacoes && <p className="text-base text-muted-foreground">{d.observacoes}</p>}
        {d.situacao === 'tomado' ? (
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-ok">
            <CheckCircleIcon className="size-6" weight="fill" aria-hidden />
            {d.tomadoEm ? `Tomado às ${horaDe(d.tomadoEm)}` : 'Tomado'}
          </p>
        ) : d.situacao === 'nao_tomado' ? (
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-atraso">
            <XCircleIcon className="size-6" weight="fill" aria-hidden />
            Não tomado
          </p>
        ) : (
          futuro && <p className="text-base text-muted-foreground">Ainda não chegou o dia.</p>
        )}
      </div>
      {marcada ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => marcar('pendente')}
          aria-label={
            d.situacao === 'tomado'
              ? `Desfazer: ${d.nome} não foi tomado`
              : `Desfazer: ${d.nome} volta a ficar pendente`
          }
          className="text-muted-foreground"
        >
          <ArrowCounterClockwiseIcon aria-hidden />
          Desfazer
        </Button>
      ) : (
        !futuro && (
          <div className="flex flex-col items-stretch gap-1">
            <Button size="lg" onClick={() => marcar('tomado')} aria-label={`Tomei ${d.nome}`} className="px-5">
              <CheckCircleIcon aria-hidden />
              Tomei
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => marcar('nao_tomado')}
              aria-label={`Não tomei ${d.nome}`}
              className="text-muted-foreground"
            >
              Não tomei
            </Button>
          </div>
        )
      )}
    </li>
  )
}
