import type { ComponentType, ReactNode } from 'react'

type Props = {
  /** Ícone da área (Phosphor ou Lucide), mostrado num selo na cor da tela. */
  icone: ComponentType<{ className?: string }>
  /** Desenho de `components/ilustracoes/`; quando vem, ocupa o lugar do selo. */
  ilustracao?: ReactNode
  titulo: string
  children?: ReactNode
  acao?: ReactNode
}

/** Tela ou lista vazia: direto no papel, com o próximo passo à mão. */
export function EstadoVazio({ icone: Icone, ilustracao, titulo, children, acao }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
      {ilustracao ?? (
        <span className="selo-area mb-1 size-16 rounded-2xl" aria-hidden>
          <Icone className="size-9" />
        </span>
      )}
      <h2 className="text-secao font-bold">{titulo}</h2>
      {children && <div className="max-w-prose text-muted-foreground">{children}</div>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  )
}
