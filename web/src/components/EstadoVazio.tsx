import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = { icone: LucideIcon; titulo: string; children?: ReactNode; acao?: ReactNode }

export function EstadoVazio({ icone: Icone, titulo, children, acao }: Props) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card p-6">
      <Icone className="size-8 text-primary" aria-hidden />
      <h2 className="text-xl font-bold">{titulo}</h2>
      {children && <div className="max-w-prose text-muted-foreground">{children}</div>}
      {acao}
    </div>
  )
}
