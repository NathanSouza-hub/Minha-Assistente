import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { hojeISO, rotuloDoDia, somarDias } from '@/lib/datas'

/** ‹ Hoje, 13 de outubro › com "Voltar para hoje" quando estiver em outro dia. */
export function NavegadorDia({ data, aoMudar }: { data: string; aoMudar: (data: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Dia" className="flex items-center justify-between gap-2 rounded-xl bg-folha p-1 shadow-folha">
        <Button variant="ghost" size="icon" onClick={() => aoMudar(somarDias(data, -1))} aria-label="Dia anterior">
          <CaretLeftIcon className="size-7" weight="bold" aria-hidden />
        </Button>
        <h2 className="text-center text-lg font-bold min-[400px]:text-xl" aria-live="polite">
          {rotuloDoDia(data)}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => aoMudar(somarDias(data, 1))} aria-label="Próximo dia">
          <CaretRightIcon className="size-7" weight="bold" aria-hidden />
        </Button>
      </nav>
      {data !== hojeISO() && (
        <Button variant="link" className="self-center" onClick={() => aoMudar(hojeISO())}>
          Voltar para hoje
        </Button>
      )}
    </div>
  )
}
