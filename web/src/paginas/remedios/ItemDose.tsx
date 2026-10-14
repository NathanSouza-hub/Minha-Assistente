import { CircleCheck, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRegistrarDose } from '@/consultas/medicamentos'
import { horaDe } from '@/lib/datas'
import type { DoseDoDia } from '@/lib/tipos'
import { cn } from '@/lib/utils'

export function ItemDose({ dose: d, futuro }: { dose: DoseDoDia; futuro: boolean }) {
  const registrar = useRegistrarDose(d.data)
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center',
        d.tomado && 'bg-secondary/60',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-lg font-bold">
          {d.nome}
          {d.hora && <span className="ml-2 font-semibold text-muted-foreground tabular-nums">{d.hora}</span>}
        </p>
        {d.dose && <p className="text-base">{d.dose}</p>}
        {d.observacoes && <p className="text-base text-muted-foreground">{d.observacoes}</p>}
      </div>
      {d.tomado ? (
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <p className="flex items-center gap-1.5 font-semibold text-primary">
            <CircleCheck className="size-6" aria-hidden />
            {d.tomadoEm ? `Tomado às ${horaDe(d.tomadoEm)}` : 'Tomado'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => registrar.mutate({ horarioId: d.horarioId, tomado: false })}
            aria-label={`Desfazer: ${d.nome} não foi tomado`}
          >
            <Undo2 aria-hidden />
            Desfazer
          </Button>
        </div>
      ) : futuro ? (
        <p className="text-base text-muted-foreground">Ainda não chegou o dia.</p>
      ) : (
        <Button
          size="lg"
          onClick={() => registrar.mutate({ horarioId: d.horarioId, tomado: true })}
          aria-label={`Tomei ${d.nome}`}
          className="w-full sm:w-auto"
        >
          <CircleCheck aria-hidden />
          Tomei
        </Button>
      )}
    </li>
  )
}
