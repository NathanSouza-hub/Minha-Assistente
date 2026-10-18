import { ArrowCounterClockwiseIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useRegistrarDose } from '@/consultas/medicamentos'
import { horaDe } from '@/lib/datas'
import type { DoseDoDia } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/** Remédio à esquerda, "Tomei" (ou "Desfazer") à direita, ao alcance do polegar. */
export function ItemDose({ dose: d, futuro }: { dose: DoseDoDia; futuro: boolean }) {
  const registrar = useRegistrarDose(d.data)
  return (
    <li className="flex items-center gap-3 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn('text-lg font-bold', d.tomado && 'text-muted-foreground')}>
          {d.nome}
          {d.hora && <span className="ml-2 font-semibold text-muted-foreground tabular-nums">{d.hora}</span>}
        </p>
        {d.dose && <p className="text-base">{d.dose}</p>}
        {d.observacoes && <p className="text-base text-muted-foreground">{d.observacoes}</p>}
        {d.tomado ? (
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-ok">
            <CheckCircleIcon className="size-6" weight="fill" aria-hidden />
            {d.tomadoEm ? `Tomado às ${horaDe(d.tomadoEm)}` : 'Tomado'}
          </p>
        ) : (
          futuro && <p className="text-base text-muted-foreground">Ainda não chegou o dia.</p>
        )}
      </div>
      {d.tomado ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => registrar.mutate({ horarioId: d.horarioId, tomado: false })}
          aria-label={`Desfazer: ${d.nome} não foi tomado`}
          className="text-muted-foreground"
        >
          <ArrowCounterClockwiseIcon aria-hidden />
          Desfazer
        </Button>
      ) : (
        !futuro && (
          <Button
            size="lg"
            onClick={() => registrar.mutate({ horarioId: d.horarioId, tomado: true })}
            aria-label={`Tomei ${d.nome}`}
            className="px-5"
          >
            <CheckCircleIcon aria-hidden />
            Tomei
          </Button>
        )
      )}
    </li>
  )
}
