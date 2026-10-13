import { useEffect, type ReactNode } from 'react'

type Props = { titulo: string; subtitulo: string; children: ReactNode; rodape: ReactNode }

/** Moldura das telas de entrar e criar conta. */
export function LayoutVisitante({ titulo, subtitulo, children, rodape }: Props) {
  useEffect(() => {
    document.title = `${titulo} · Minha Assistente`
  }, [titulo])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-10 pb-8 md:justify-center md:pt-8">
      <div className="mb-8 flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-12" />
        <p className="text-xl font-bold text-primary">Minha Assistente</p>
      </div>
      <div className="relative mb-8 pl-5">
        <span aria-hidden className="absolute top-1 bottom-1 left-0 w-1.5 rounded-full bg-hoje" />
        <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{subtitulo}</p>
      </div>
      {children}
      <div className="mt-8 border-t pt-6 text-lg">{rodape}</div>
    </main>
  )
}
