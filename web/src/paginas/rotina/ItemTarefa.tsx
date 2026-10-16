import { Check } from 'lucide-react'
import { useConcluirTarefa } from '@/consultas/rotinas'
import { horaDe } from '@/lib/datas'
import type { TarefaDoDia } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/** A linha inteira é a caixa de marcar: alvo grande para quem tem pouca precisão no toque. */
export function ItemTarefa({ tarefa: t, desabilitada }: { tarefa: TarefaDoDia; desabilitada: boolean }) {
  const concluir = useConcluirTarefa(t.data)
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={t.concluida}
        disabled={desabilitada}
        onClick={() => concluir.mutate({ rotinaId: t.rotinaId, concluida: !t.concluida })}
        className={cn(
          'flex min-h-16 w-full items-center gap-4 rounded-xl border bg-card p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60',
          t.concluida && 'bg-secondary/60',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg border-2',
            t.concluida ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card',
          )}
        >
          {t.concluida && <Check className="size-6" strokeWidth={3} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('text-lg font-semibold', t.concluida && 'text-muted-foreground line-through')}>
            {t.titulo}
          </span>
          <span className="text-base text-muted-foreground">
            {t.concluida && t.concluidaEm
              ? `Feito às ${horaDe(t.concluidaEm)}`
              : t.hora
                ? `Às ${t.hora}`
                : 'Qualquer hora'}
          </span>
        </span>
      </button>
    </li>
  )
}
