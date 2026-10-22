import { useId, type ComponentProps, type ReactNode } from 'react'
import { CaretDownIcon } from '@phosphor-icons/react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = ComponentProps<'select'> & { rotulo: string; erro?: string; dica?: ReactNode }

/**
 * <select> nativo com o visual dos campos. Nativo de propósito: no celular abre a lista do
 * sistema, que é grande, rolável e familiar para quem tem pouca prática.
 */
export function Selecao({ rotulo, erro, dica, className, children, ...props }: Props) {
  const id = useId()
  const descricoes = [dica && `${id}-dica`, erro && `${id}-erro`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricoes}
          className={cn(
            'h-12 w-full appearance-none rounded-lg border-[1.5px] border-input bg-folha pr-12 pl-3 text-base outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <CaretDownIcon
          className="pointer-events-none absolute top-1/2 right-3 size-6 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
      {dica && !erro && (
        <div id={`${id}-dica`} className="text-base text-muted-foreground">
          {dica}
        </div>
      )}
      {erro && (
        <p id={`${id}-erro`} className="text-base font-semibold text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}
