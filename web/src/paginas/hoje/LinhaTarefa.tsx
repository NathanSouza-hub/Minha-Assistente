import type { ReactNode } from 'react'
import {
  AirplaneTiltIcon,
  CalendarDotsIcon,
  CheckIcon,
  CheckSquareIcon,
  HeartbeatIcon,
  ListChecksIcon,
  MicrophoneStageIcon,
  PersonSimpleRunIcon,
  PillIcon,
  ReceiptIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import { Link, useNavigate } from 'react-router'
import type { Area } from '@/app/navegacao'
import { useMarcarTarefa } from '@/consultas/hoje'
import type { CategoriaTarefa, MarcacaoTarefa, TarefaHoje } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/** Ícone, cor da área e o que o ✓ e o ✗ querem dizer em cada categoria. */
const CATEGORIAS: Record<CategoriaTarefa, { icone: Icon; area: Area; feito: string; naoFeito: string }> = {
  remedio: { icone: PillIcon, area: 'remedios', feito: 'Tomei', naoFeito: 'Não tomei' },
  despesa: { icone: ReceiptIcon, area: 'contas', feito: 'Paguei', naoFeito: 'Não paguei' },
  agenda: { icone: CalendarDotsIcon, area: 'agenda', feito: 'Fiz', naoFeito: 'Não fiz' },
  compromisso: { icone: CheckSquareIcon, area: 'compromissos', feito: 'Fiz', naoFeito: 'Não fiz' },
  atividade: { icone: PersonSimpleRunIcon, area: 'atividade', feito: 'Fiz', naoFeito: 'Não fiz' },
  fisioterapia: { icone: HeartbeatIcon, area: 'fisioterapia', feito: 'Fiz', naoFeito: 'Não fiz' },
  radio: { icone: MicrophoneStageIcon, area: 'radio', feito: 'Realizado', naoFeito: 'Não realizado' },
  viagem: { icone: AirplaneTiltIcon, area: 'viagens', feito: 'Realizado', naoFeito: 'Não realizado' },
  tarefa: { icone: ListChecksIcon, area: 'tarefas', feito: 'Fiz', naoFeito: 'Não fiz' },
}

/**
 * Horário à esquerda, selo da área, título e detalhe, e ✓/✗ à direita (≥ 44px). Tocar no botão
 * já marcado volta para pendente.
 */
export function LinhaTarefa({ tarefa: t, data }: { tarefa: TarefaHoje; data: string }) {
  const marcar = useMarcarTarefa(data)
  const navegar = useNavigate()
  const { icone: Icone, area, feito, naoFeito } = CATEGORIAS[t.categoria]
  const marcarComo = (status: Exclude<MarcacaoTarefa, 'pendente'>) => {
    // Conta da equipe com valor a definir: o valor pago é informado no formulário dela.
    if (status === 'feito' && t.concluirNoFormulario) return navegar(t.link)
    marcar.mutate({ tarefa: t, status: t.status === status ? 'pendente' : status })
  }

  return (
    <li className={cn('flex items-center gap-2 py-3 sm:gap-3', `area-${area}`)}>
      <span
        className={cn(
          'w-12 shrink-0 text-base font-semibold tabular-nums',
          t.status === 'atrasado' ? 'text-atraso' : 'text-muted-foreground',
        )}
      >
        {t.horario}
        {t.status === 'atrasado' && <span className="sr-only"> (atrasado)</span>}
      </span>
      <span className="selo-area hidden size-10 shrink-0 min-[400px]:flex" aria-hidden>
        <Icone className="size-6" weight="fill" />
      </span>
      <Link to={t.link} className="min-w-0 flex-1 rounded-lg py-1 hover:bg-area-fundo/40">
        <p
          className={cn(
            'text-lg leading-snug font-bold break-words',
            t.status === 'feito' && 'text-muted-foreground line-through',
          )}
        >
          {t.titulo}
        </p>
        {t.detalhe && (
          <p className={cn('text-base', t.status === 'feito' ? 'text-muted-foreground' : 'text-foreground/80')}>
            {t.detalhe}
          </p>
        )}
      </Link>
      <div className="flex shrink-0 gap-2">
        <BotaoMarcar
          rotulo={`${feito}: ${t.titulo}`}
          marcado={t.status === 'feito'}
          cor="ok"
          aoTocar={() => marcarComo('feito')}
        >
          <CheckIcon weight="bold" />
        </BotaoMarcar>
        <BotaoMarcar
          rotulo={`${naoFeito}: ${t.titulo}`}
          marcado={t.status === 'nao_feito'}
          cor="atraso"
          aoTocar={() => marcarComo('nao_feito')}
        >
          <XIcon weight="bold" />
        </BotaoMarcar>
      </div>
    </li>
  )
}

function BotaoMarcar({
  rotulo,
  marcado,
  cor,
  aoTocar,
  children,
}: {
  rotulo: string
  marcado: boolean
  cor: 'ok' | 'atraso'
  aoTocar: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-label={rotulo}
      aria-pressed={marcado}
      className={cn(
        'flex size-11 items-center justify-center rounded-full border-2 transition-colors [&_svg]:size-6',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        cor === 'ok'
          ? marcado
            ? 'border-ok bg-ok text-white'
            : 'border-ok text-ok hover:bg-ok-fundo'
          : marcado
            ? 'border-atraso bg-atraso text-white'
            : 'border-atraso text-atraso hover:bg-atraso-fundo',
      )}
    >
      {children}
    </button>
  )
}
