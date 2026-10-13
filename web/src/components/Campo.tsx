import { useId, useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = ComponentProps<typeof Input> & {
  rotulo: string
  erro?: string
  dica?: string
}

/** Campo de formulário com rótulo, dica e mensagem de erro ligados por aria-describedby. */
export function Campo({ rotulo, erro, dica, type, className, ...props }: Props) {
  const id = useId()
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const ehSenha = type === 'password'
  const descricoes = [dica && `${id}-dica`, erro && `${id}-erro`].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative">
        <Input
          id={id}
          type={ehSenha && mostrarSenha ? 'text' : type}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricoes}
          className={cn(ehSenha && 'pr-14', className)}
          {...props}
        />
        {ehSenha && (
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
            aria-pressed={mostrarSenha}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground"
          >
            {mostrarSenha ? <EyeOff className="size-6" aria-hidden /> : <Eye className="size-6" aria-hidden />}
          </button>
        )}
      </div>
      {dica && !erro && (
        <p id={`${id}-dica`} className="text-base text-muted-foreground">
          {dica}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} className="text-base font-semibold text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}
