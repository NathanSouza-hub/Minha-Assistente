import type { ReactNode } from 'react'
import { useEffect } from 'react'

type Props = {
  titulo: string
  /** Substitui o título visível (o título da aba continua sendo `titulo`). */
  cabecalho?: ReactNode
  acoes?: ReactNode
  children: ReactNode
}

export function Pagina({ titulo, cabecalho, acoes, children }: Props) {
  useEffect(() => {
    document.title = `${titulo} · Minha Assistente`
  }, [titulo])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        {cabecalho ?? <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>}
        {acoes}
      </header>
      {children}
    </div>
  )
}
