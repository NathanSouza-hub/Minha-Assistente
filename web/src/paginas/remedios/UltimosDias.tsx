import { useQueries } from '@tanstack/react-query'
import { chavesRemedios } from '@/consultas/medicamentos'
import { api } from '@/lib/api'
import { deDataISO, hojeISO, somarDias } from '@/lib/datas'
import type { DoseDoDia } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const DIAS = 7

/**
 * Histórico curto: os 7 dias até o dia aberto (nunca depois de hoje), cada um com as doses tomadas
 * de quantas havia. Tocar num dia abre as doses dele. Mesmas consultas de `useDosesDoDia` (cache).
 */
export function UltimosDias({ data, aoEscolher }: { data: string; aoEscolher: (data: string) => void }) {
  const fim = data > hojeISO() ? hojeISO() : data
  const dias = Array.from({ length: DIAS }, (_, i) => somarDias(fim, i - DIAS + 1))
  const consultas = useQueries({
    queries: dias.map((d) => ({
      queryKey: chavesRemedios.doDia(d),
      queryFn: () => api<DoseDoDia[]>('/medicamentos/hoje', { query: { data: d } }),
    })),
  })
  if (consultas.every((c) => c.isSuccess && c.data.length === 0)) return null

  return (
    <section aria-labelledby="ultimos-dias" className="flex flex-col gap-2">
      <h2 id="ultimos-dias" className="text-secao font-bold">
        Últimos {DIAS} dias
      </h2>
      <ol className="grid grid-cols-7 gap-1.5">
        {dias.map((d, i) => {
          const doses = consultas[i].data
          const tomadas = doses?.filter((x) => x.tomado).length ?? 0
          const total = doses?.length ?? 0
          const parte = total ? tomadas / total : 0
          const dt = deDataISO(d).setLocale('pt-BR')
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => aoEscolher(d)}
                aria-current={d === data ? 'date' : undefined}
                aria-label={`${dt.toFormat("cccc, d 'de' LLLL")}: ${doses ? `${tomadas} de ${total} doses tomadas` : 'carregando'}`}
                className={cn(
                  'flex w-full flex-col items-center gap-1 rounded-2xl bg-folha py-2 text-apoio hover:bg-suave',
                  d === data && 'ring-2 ring-grafite',
                )}
              >
                <span className="text-[0.75rem] font-semibold text-muted-foreground uppercase">
                  {dt.toFormat('ccc').replace('.', '')}
                </span>
                {/* Coluna que enche de baixo para cima: a altura é a parte das doses tomadas. */}
                <span aria-hidden className="relative h-10 w-3 overflow-hidden rounded-full bg-area-fundo">
                  <span className="absolute inset-x-0 bottom-0 rounded-full bg-area" style={{ height: `${parte * 100}%` }} />
                </span>
                <span className="font-bold tabular-nums">{doses ? (total ? `${tomadas}/${total}` : '—') : '…'}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
