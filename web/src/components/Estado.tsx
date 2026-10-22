import type { ReactNode } from 'react'
import { CheckIcon, ClockIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/**
 * Os estados do app, iguais em todas as áreas (tabela "Estados" de docs/identidade-visual.md).
 * Cor nunca vem sozinha: sempre há ícone e texto. Nenhuma tela monta a cor de estado à mão.
 */

export type EstadoMarca = 'pendente' | 'agora' | 'feito' | 'nao_feito'

/** Círculo de uma linha de lista (26px; o botão em volta é que garante os 44px de toque). */
export function MarcaEstado({ estado, className }: { estado: EstadoMarca; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-[1.6rem] shrink-0 place-items-center rounded-full transition-colors [&_svg]:size-4',
        estado === 'pendente' && 'border-2 border-[#a9b5c9]',
        estado === 'agora' && 'border-2 border-primary',
        estado === 'feito' && 'bg-ok text-folha',
        estado === 'nao_feito' && 'bg-[#e3e8f0] text-muted-foreground [&_svg]:size-3.5',
        className,
      )}
    >
      {estado === 'feito' && <CheckIcon weight="bold" />}
      {estado === 'nao_feito' && <XIcon weight="bold" />}
    </span>
  )
}

export type EstadoSelo = 'vence_hoje' | 'vencido' | 'a_definir' | 'feito' | 'nao_feito' | 'agora'

const TEXTO_PADRAO: Record<EstadoSelo, string> = {
  vence_hoje: 'Vence hoje',
  vencido: 'Vencido',
  a_definir: 'Valor a definir',
  feito: 'Feito',
  nao_feito: 'Não fiz',
  agora: 'agora',
}

/**
 * Texto de estado com o ícone. "Vence hoje" é o único selo cheio do app (âmbar, texto grafite);
 * os outros são texto colorido com ícone.
 */
export function SeloEstado({ estado, children, className }: { estado: EstadoSelo; children?: ReactNode; className?: string }) {
  const texto = children ?? TEXTO_PADRAO[estado]
  if (estado === 'vence_hoje') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-ambar px-2.5 py-0.5 text-[0.82rem] font-bold whitespace-nowrap text-grafite',
          className,
        )}
      >
        <ClockIcon weight="bold" className="size-3.5" aria-hidden />
        {texto}
      </span>
    )
  }
  const Icone = { vencido: WarningCircleIcon, feito: CheckIcon, nao_feito: XIcon, a_definir: null, agora: null }[estado]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold',
        estado === 'vencido' && 'text-atraso',
        estado === 'a_definir' && 'text-alerta',
        estado === 'feito' && 'text-ok',
        estado === 'nao_feito' && 'text-muted-foreground',
        estado === 'agora' && 'text-primary',
        className,
      )}
    >
      {Icone && <Icone weight="bold" className="size-4 shrink-0" aria-hidden />}
      {texto}
    </span>
  )
}
