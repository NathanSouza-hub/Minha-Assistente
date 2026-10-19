import { useEffect, type ReactNode } from 'react'

type Props = {
  titulo: string
  subtitulo: string
  children: ReactNode
  rodape: ReactNode
  /** Desenho de `components/ilustracoes/` mostrado na capa. */
  ilustracao?: ReactNode
}

/** Moldura das telas de entrar e criar conta: a capa petróleo com a marca e o formulário no papel. */
export function LayoutVisitante({ titulo, subtitulo, children, rodape, ilustracao }: Props) {
  useEffect(() => {
    document.title = `${titulo} · Minha Assistente`
  }, [titulo])

  return (
    <div className="flex min-h-dvh flex-col md:items-center md:justify-center md:py-10">
      <div className="flex w-full flex-1 flex-col md:max-w-md md:flex-none md:overflow-hidden md:rounded-2xl md:bg-folha md:shadow-folha">
        <header className="capa px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-7 md:px-8 md:pt-8">
          <div className="mb-7 flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-11" />
            <p className="text-xl font-bold">Minha Assistente</p>
          </div>
          {ilustracao && <div className="mb-5">{ilustracao}</div>}
          <h1 className="text-[1.75rem] leading-tight font-[750] tracking-[-0.01em]">{titulo}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{subtitulo}</p>
        </header>
        <div aria-hidden className="h-1.5 bg-hoje" />
        <main className="flex flex-1 flex-col px-4 pt-7 pb-8 md:px-8">
          {children}
          {rodape && <div className="mt-8 border-t pt-6 text-lg">{rodape}</div>}
        </main>
      </div>
    </div>
  )
}
