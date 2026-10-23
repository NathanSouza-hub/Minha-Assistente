import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Area } from '@/app/navegacao'
import { agora } from '@/lib/datas'
import type { CategoriaTarefa, TarefasHoje } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/** Categorias que contam como "agenda" e como "lembretes" nos blocos do Início. */
const DA_AGENDA: CategoriaTarefa[] = ['agenda', 'fisioterapia', 'atividade', 'radio', 'viagem']
const DOS_LEMBRETES: CategoriaTarefa[] = ['tarefa', 'compromisso']

/**
 * Os blocos coloridos do Início, um por área, com os números do dia aberto (vêm da mesma lista de
 * `/hoje`, sem outra consulta): doses tomadas, o próximo da agenda e os lembretes feitos.
 */
export function ResumoDasAreas({ dia, ehHoje }: { dia: TarefasHoje; ehHoje: boolean }) {
  const remedios = dia.tarefas.filter((t) => t.categoria === 'remedio')
  const tomados = remedios.filter((t) => t.status === 'feito').length
  const lembretes = dia.tarefas.filter((t) => DOS_LEMBRETES.includes(t.categoria))
  const feitos = lembretes.filter((t) => t.status === 'feito').length

  const hora = agora().toFormat('HH:mm')
  const daAgenda = dia.tarefas.filter(
    (t) => DA_AGENDA.includes(t.categoria) && (t.status === 'pendente' || t.status === 'atrasado'),
  )
  // Hoje: o próximo que ainda não passou; em outro dia, o primeiro do dia.
  const proximo = (ehHoje ? daAgenda.find((t) => t.horario && t.horario >= hora) : daAgenda[0]) ?? null

  return (
    <div className="grid grid-cols-2 gap-3">
      <Bloco area="remedios" rotulo="Remédios" para="/remedios" grafico={remedios.length > 0 && <Anel feitos={tomados} total={remedios.length} />}>
        {remedios.length > 0 ? (
          <>
            <Numero>
              {tomados} de {remedios.length}
            </Numero>
            <span>doses {ehHoje ? 'de hoje' : 'do dia'}</span>
          </>
        ) : (
          <span className="mt-1 font-semibold text-grafite">Nenhuma dose {ehHoje ? 'hoje' : 'no dia'}</span>
        )}
      </Bloco>

      <Bloco area="agenda" rotulo={proximo ? 'Próximo na agenda' : 'Agenda'} para={proximo?.link ?? '/agenda'}>
        {proximo ? (
          <>
            <Numero>{proximo.horario ?? 'Dia todo'}</Numero>
            <span className="line-clamp-2 break-words">{proximo.titulo}</span>
          </>
        ) : (
          <span className="mt-1 font-semibold text-grafite">Nada mais {ehHoje ? 'hoje' : 'no dia'}</span>
        )}
      </Bloco>

      <Bloco area="tarefas" rotulo="Lembretes" para="/rotina" largo>
        {lembretes.length > 0 ? (
          <>
            <Numero>
              {feitos} de {lembretes.length}
            </Numero>
            <span>feitos {ehHoje ? 'hoje' : 'no dia'}</span>
          </>
        ) : (
          <span className="mt-1 font-semibold text-grafite">Nenhum {ehHoje ? 'hoje' : 'no dia'}</span>
        )}
      </Bloco>

    </div>
  )
}

function Bloco({
  area,
  rotulo,
  para,
  grafico,
  largo,
  children,
}: {
  area: Area
  rotulo: string
  para: string
  grafico?: ReactNode
  /** Ocupa a linha toda, com o rótulo à esquerda e o número à direita. */
  largo?: boolean
  children: ReactNode
}) {
  const conteudo = largo ? (
    <>
      <span className="text-apoio font-bold">{rotulo}</span>
      <span className="flex flex-col items-end text-right">{children}</span>
    </>
  ) : (
    <>
      <span className="flex items-center justify-between gap-2 text-apoio font-bold">
        {rotulo}
        {grafico}
      </span>
      {children}
    </>
  )
  const classes = cn(
    `area-${area} flex gap-0.5 rounded-[1.4rem] bg-area-fundo px-4 py-3.5 text-apoio text-area transition-[filter] hover:brightness-[0.97]`,
    largo ? 'col-span-2 items-center justify-between gap-3' : 'min-h-[7.5rem] flex-col',
  )
  return para.startsWith('#') ? (
    <a href={para} className={classes}>
      {conteudo}
    </a>
  ) : (
    <Link to={para} className={classes}>
      {conteudo}
    </Link>
  )
}

function Numero({ children }: { children: ReactNode }) {
  return (
    <span className="font-heading text-[1.65rem] leading-[1.05] font-bold tracking-[-0.02em] text-grafite tabular-nums">
      {children}
    </span>
  )
}

/** Anel de progresso; o texto ao lado já diz o número, então ele é só decoração. */
function Anel({ feitos, total }: { feitos: number; total: number }) {
  const r = 14
  const volta = 2 * Math.PI * r
  return (
    <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden className="shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeOpacity={0.16} strokeWidth="5" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(feitos / total) * volta} ${volta}`}
        transform="rotate(-90 18 18)"
      />
    </svg>
  )
}
