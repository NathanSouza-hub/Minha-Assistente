import type { ReactNode } from 'react'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { SeletorDia } from '@/components/SeletorPeriodo'
import { Button } from '@/components/ui/button'
import { hojeISO, rotuloDoDia, somarDias } from '@/lib/datas'

/**
 * "Hoje, 13 de outubro" à esquerda (toque abre o calendário para escolher o dia direto) e as setas
 * à direita, com "Voltar para hoje" quando estiver em outro dia.
 */
export function NavegadorDia({ data, aoMudar }: { data: string; aoMudar: (data: string) => void }) {
  return (
    <div className="flex flex-col">
      <Navegador
        rotulo="Dia"
        titulo={<SeletorDia data={data} aoMudar={aoMudar} texto={rotuloDoDia(data)} />}
        anterior={{ rotulo: 'Dia anterior', ir: () => aoMudar(somarDias(data, -1)) }}
        proximo={{ rotulo: 'Próximo dia', ir: () => aoMudar(somarDias(data, 1)) }}
      />
      {data !== hojeISO() && (
        <Button variant="link" className="h-11 self-start px-0" onClick={() => aoMudar(hojeISO())}>
          Voltar para hoje
        </Button>
      )}
    </div>
  )
}

type Passo = { rotulo: string; ir: () => void }

/** Título do período (em geral o botão do `SeletorPeriodo`) e as duas setas; base do navegador de dia e de mês. */
export function Navegador({ rotulo, titulo, anterior, proximo }: { rotulo: string; titulo: ReactNode; anterior: Passo; proximo: Passo }) {
  return (
    <nav aria-label={rotulo} className="flex items-center justify-between gap-2">
      <h2 className="text-secao font-bold" aria-live="polite">
        {titulo}
      </h2>
      <div className="flex shrink-0">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={anterior.ir} aria-label={anterior.rotulo}>
          <CaretLeftIcon className="size-6" weight="bold" aria-hidden />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={proximo.ir} aria-label={proximo.rotulo}>
          <CaretRightIcon className="size-6" weight="bold" aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
