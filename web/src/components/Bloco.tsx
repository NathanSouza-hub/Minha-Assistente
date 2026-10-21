import type { ReactNode } from 'react'
import { CaretRightIcon, type Icon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import type { Area } from '@/app/navegacao'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Props = {
  titulo: string
  icone: Icon
  area: Area
  /** "Ver tudo": a tela da área com o detalhe (sem ele, o bloco já está na tela da área). */
  link?: { para: string; rotulo: string }
  /** Situação da consulta que alimenta o bloco; os dados só são desenhados quando chegam. */
  consulta: { isPending: boolean; isError: boolean; refetch: () => unknown }
  className?: string
  children: () => ReactNode
}

/** Cartão de resumo (Visão geral e topo das telas de Finanças): selo e título da área, o atalho para a tela dela e carregando/erro/conteúdo. */
export function Bloco({ titulo, icone: Icone, area, link, consulta, className, children }: Props) {
  const id = `bloco-${titulo.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section
      aria-labelledby={id}
      className={cn(`area-${area} flex flex-col gap-4 rounded-2xl bg-folha p-4 shadow-folha md:p-5`, className)}
    >
      <header className="flex items-center gap-3">
        <span className="selo-area size-10" aria-hidden>
          <Icone className="size-6" weight="fill" />
        </span>
        <h2 id={id} className="flex-1 text-xl font-bold">
          {titulo}
        </h2>
        {link && (
          <Link
            to={link.para}
            className="-mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-base font-semibold text-primary hover:bg-primary/8"
          >
            {link.rotulo}
            <CaretRightIcon weight="bold" className="size-4" aria-hidden />
          </Link>
        )}
      </header>
      {consulta.isPending ? (
        <div role="status" aria-label={`Carregando ${titulo.toLowerCase()}`} className="flex flex-col gap-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : consulta.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">Não foi possível carregar. Verifique a internet.</p>
          <Button variant="outline" size="sm" onClick={() => consulta.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        children()
      )}
    </section>
  )
}

/** Texto curto de bloco sem nada a mostrar. */
export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-2 text-muted-foreground">{children}</p>
}
