import { useEffect, type ReactNode } from 'react'

type Props = {
  titulo: string
  subtitulo: string
  children: ReactNode
  rodape: ReactNode
  /** Desenho de `components/ilustracoes/` mostrado no cabeçalho. */
  ilustracao?: ReactNode
}

/** Moldura das telas de entrar e criar conta: a marca, o título e o formulário, tudo no fundo claro. */
export function LayoutVisitante({ titulo, subtitulo, children, rodape, ilustracao }: Props) {
  useEffect(() => {
    document.title = `${titulo} · Minha Assistente`
  }, [titulo])

  return (
    <div className="flex min-h-dvh flex-col md:items-center md:justify-center md:py-10">
      <div className="flex w-full flex-1 flex-col md:max-w-md md:flex-none md:overflow-hidden md:rounded-2xl md:bg-folha md:shadow-folha">
        <header className="px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-2 md:px-8 md:pt-8">
          <div className="mb-7 flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-11" />
            <p className="text-xl font-bold tracking-[-0.01em]">Minha Assistente</p>
          </div>
          {ilustracao && <div className="mb-5">{ilustracao}</div>}
          <h1 className="text-[1.65rem] leading-tight font-bold tracking-[-0.02em]">{titulo}</h1>
          <p className="mt-1 text-base text-muted-foreground">{subtitulo}</p>
        </header>
        <main className="flex flex-1 flex-col px-4 pt-5 pb-8 md:px-8">
          {children}
          {rodape && <div className="mt-8 border-t pt-6 text-lg">{rodape}</div>}
        </main>
      </div>
    </div>
  )
}
