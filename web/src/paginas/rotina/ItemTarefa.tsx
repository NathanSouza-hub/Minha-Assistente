import { CheckIcon } from '@phosphor-icons/react'
import { useConcluirTarefa } from '@/consultas/rotinas'
import { horaDe } from '@/lib/datas'
import type { TarefaDoDia } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/** A linha inteira é a caixa de marcar: alvo grande para quem tem pouca precisão no toque. */
export function ItemTarefa({ tarefa: t, desabilitada }: { tarefa: TarefaDoDia; desabilitada: boolean }) {
  const concluir = useConcluirTarefa(t.data)
  return (
    <li className="py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={t.concluida}
        disabled={desabilitada}
        onClick={() => concluir.mutate({ rotinaId: t.rotinaId, concluida: !t.concluida })}
        className={cn(
          '-mx-2 flex min-h-16 w-[calc(100%+1rem)] items-center gap-4 rounded-lg px-2 py-2 text-left outline-none hover:bg-areia/70 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg border-2',
            t.concluida ? 'border-ok bg-ok text-folha' : 'border-input bg-folha',
          )}
        >
          {t.concluida && <CheckIcon className="size-6" weight="bold" />}
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
