import { useState } from 'react'
import { BookOpenTextIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { FONTE_DOS_VERSOS, versoDoDia, type Verso } from '@/lib/versos'

/**
 * Verso do Dia no Início. O texto vem da lista guardada no app (não depende de internet); só o
 * capítulo inteiro, ao tocar em "Ler o capítulo", é buscado na bible-api.com (mesma tradução).
 */
export function VersoDoDia({ data }: { data: string }) {
  const verso = versoDoDia(data)
  const [aberto, setAberto] = useState(false)
  return (
    <section aria-labelledby="verso-do-dia" className="relative overflow-hidden rounded-[1.5rem] bg-folha p-5">
      <p id="verso-do-dia" className="flex items-center gap-2 text-apoio font-bold text-[#5a4710]">
        <BookOpenTextIcon weight="fill" className="size-5 text-ambar" aria-hidden />
        Verso do dia
      </p>
      <blockquote className="mt-3">
        <p className="font-heading text-[1.3rem] leading-snug font-semibold tracking-[-0.01em] text-pretty">
          “{verso.texto}”
        </p>
        <footer className="mt-3 text-apoio">
          <cite className="font-bold not-italic">{verso.referencia}</cite>
          <span className="text-muted-foreground"> · {FONTE_DOS_VERSOS}</span>
        </footer>
      </blockquote>
      <Button variant="secondary" className="mt-4" onClick={() => setAberto(true)}>
        Ler o capítulo
      </Button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-[1.75rem] px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {aberto && <Capitulo verso={verso} />}
        </SheetContent>
      </Sheet>
    </section>
  )
}

type CapituloApi = { reference: string; verses: { verse: number; text: string }[] }

function Capitulo({ verso }: { verso: Verso }) {
  const capitulo = useQuery({
    queryKey: ['biblia', verso.livro, verso.capitulo],
    queryFn: async () => {
      const resposta = await fetch(
        `https://bible-api.com/${encodeURIComponent(`${verso.livro} ${verso.capitulo}`)}?translation=almeida`,
      )
      if (!resposta.ok) throw new Error('capítulo indisponível')
      return (await resposta.json()) as CapituloApi
    },
    staleTime: Infinity,
    retry: 1,
  })
  const titulo = verso.referencia.replace(/:.*/, '')
  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-col gap-3">
      <SheetTitle className="font-heading text-destaque font-bold">{titulo}</SheetTitle>
      <SheetDescription>{FONTE_DOS_VERSOS}</SheetDescription>
      <div className="min-h-0 overflow-y-auto text-base leading-relaxed">
        {capitulo.isPending ? (
          <div role="status" aria-label="Carregando o capítulo" className="flex flex-col gap-2">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : capitulo.isError ? (
          <p>
            Não foi possível carregar o capítulo agora (sem internet ou o serviço da Bíblia está fora do ar). O verso
            de hoje continua aqui no Início.
          </p>
        ) : (
          <p>
            {capitulo.data.verses.map((v) => (
              <span key={v.verse}>
                <sup className="mr-1 font-bold text-muted-foreground">{v.verse}</sup>
                {v.text.trim()}{' '}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}
