import { useId } from 'react'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

type Opcao<T extends string> = { valor: T; rotulo: string; descricao?: string }

type Props<T extends string> = {
  rotulo: string
  opcoes: Opcao<T>[]
  valor: T
  aoMudar: (valor: T) => void
  /** "lista" = um cartão por linha; "segmentos" = botões lado a lado (filtros curtos). */
  formato?: 'lista' | 'segmentos'
  erro?: string
  /** Esconde o rótulo visualmente (continua para leitores de tela). */
  rotuloOculto?: boolean
}

/** Escolha única com áreas de toque grandes (radio group acessível do Radix). */
export function Opcoes<T extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  formato = 'lista',
  erro,
  rotuloOculto,
}: Props<T>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-rotulo`} className={cn('text-base leading-snug font-semibold', rotuloOculto && 'sr-only')}>
        {rotulo}
      </p>
      <RadioGroupPrimitive.Root
        aria-labelledby={`${id}-rotulo`}
        aria-describedby={erro ? `${id}-erro` : undefined}
        value={valor}
        onValueChange={(v) => aoMudar(v as T)}
        className={cn(
          formato === 'lista' ? 'grid gap-2 sm:grid-cols-2' : 'grid auto-cols-fr grid-flow-col rounded-xl bg-muted p-1',
        )}
      >
        {opcoes.map((opcao) => (
          <RadioGroupPrimitive.Item
            key={opcao.valor}
            value={opcao.valor}
            className={cn(
              'text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              formato === 'lista'
                ? 'flex min-h-14 items-center gap-3 rounded-lg border-2 border-transparent bg-folha px-4 py-3 shadow-folha data-[state=checked]:border-primary data-[state=checked]:bg-secondary'
                : 'min-h-11 rounded-lg px-2 text-center text-base font-semibold text-muted-foreground data-[state=checked]:bg-folha data-[state=checked]:text-primary data-[state=checked]:shadow-folha',
            )}
          >
            {formato === 'lista' && (
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-input in-data-[state=checked]:border-primary"
              >
                <RadioGroupPrimitive.Indicator className="size-3 rounded-full bg-primary" />
              </span>
            )}
            <span className="flex flex-col">
              <span className={cn(formato === 'lista' && 'text-base font-semibold')}>{opcao.rotulo}</span>
              {opcao.descricao && <span className="text-base text-muted-foreground">{opcao.descricao}</span>}
            </span>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
      {erro && (
        <p id={`${id}-erro`} className="text-base font-semibold text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}
