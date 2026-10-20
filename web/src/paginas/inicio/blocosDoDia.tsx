import { CalendarDotsIcon, PillIcon, SunIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { useEventos } from '@/consultas/eventos'
import { agora, deDataHoraISO, deDataISO, diaDe, diasAte, horaDe } from '@/lib/datas'
import type { TarefasHoje } from '@/lib/tipos'
import { MODALIDADES, TIPOS } from '@/paginas/agenda/textos'
import { LinhaTarefa } from '@/paginas/hoje/LinhaTarefa'
import { Bloco, Vazio } from './Bloco'

type Dia = UseQueryResult<TarefasHoje>

const QUANTAS_TAREFAS = 5

/**
 * O que falta fazer hoje (atrasadas primeiro), com o mesmo ✓/✗ da tela Hoje. Os remédios ficam no
 * bloco deles, para não aparecerem duas vezes.
 */
export function BlocoHoje({ consulta }: { consulta: Dia }) {
  return (
    <Bloco titulo="Hoje" icone={SunIcon} area="hoje" link={{ para: '/hoje', rotulo: 'Ver o dia' }} consulta={consulta}>
      {() => {
        const { data, resumo, tarefas } = consulta.data!
        const abertas = tarefas
          .filter((t) => t.categoria !== 'remedio' && (t.status === 'atrasado' || t.status === 'pendente'))
          .sort((a, b) => Number(b.status === 'atrasado') - Number(a.status === 'atrasado'))
        return (
          <div className="flex flex-col gap-3">
            <p className="text-base text-muted-foreground">
              {resumo.programadas === 0
                ? 'Nada programado para hoje.'
                : `${resumo.concluidas} de ${resumo.programadas} concluídas` +
                  (resumo.atrasadas > 0 ? ` · ${resumo.atrasadas} atrasadas` : '')}
            </p>
            {abertas.length === 0 ? (
              resumo.programadas > 0 && <Vazio>Tudo em dia por hoje.</Vazio>
            ) : (
              <ul className="flex flex-col divide-y divide-linha">
                {abertas.slice(0, QUANTAS_TAREFAS).map((t) => (
                  <LinhaTarefa key={t.id} tarefa={t} data={data} />
                ))}
              </ul>
            )}
            {abertas.length > QUANTAS_TAREFAS && (
              <Link to="/hoje" className="text-base font-semibold text-primary underline">
                Mais {abertas.length - QUANTAS_TAREFAS} no dia
              </Link>
            )}
          </div>
        )
      }}
    </Bloco>
  )
}

/** Remédios do dia com o horário e o estado de cada dose ("Tomei" funciona daqui mesmo). */
export function BlocoRemedios({ consulta }: { consulta: Dia }) {
  return (
    <Bloco
      titulo="Remédios de hoje"
      icone={PillIcon}
      area="remedios"
      link={{ para: '/remedios', rotulo: 'Remédios' }}
      consulta={consulta}
    >
      {() => {
        const { data, tarefas } = consulta.data!
        const remedios = tarefas.filter((t) => t.categoria === 'remedio')
        if (remedios.length === 0) return <Vazio>Nenhum remédio previsto para hoje.</Vazio>
        const tomados = remedios.filter((t) => t.status === 'feito').length
        return (
          <div className="flex flex-col gap-2">
            <p className="text-base text-muted-foreground">
              {tomados} de {remedios.length} {remedios.length === 1 ? 'dose tomada' : 'doses tomadas'}
            </p>
            <ul className="flex flex-col divide-y divide-linha">
              {remedios.map((t) => (
                <LinhaTarefa key={t.id} tarefa={t} data={data} />
              ))}
            </ul>
          </div>
        )
      }}
    </Bloco>
  )
}

/** "Hoje", "Amanhã" ou "qui., 22/10": cabe na coluna estreita do bloco. */
function diaRelativo(data: string) {
  const dias = diasAte(data)
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return deDataISO(data).toFormat('ccc, dd/MM')
}

const QUANTOS_AGENDAMENTOS = 5

/** Próximos agendamentos (dos próximos 30 dias) que ainda não terminaram. */
export function BlocoAgenda() {
  const consulta = useEventos({})
  return (
    <Bloco
      titulo="Próximos agendamentos"
      icone={CalendarDotsIcon}
      area="agenda"
      link={{ para: '/agenda', rotulo: 'Agenda' }}
      consulta={consulta}
    >
      {() => {
        const agoraMesmo = agora()
        const proximos = consulta
          .data!.filter((e) => deDataHoraISO(e.fim ?? e.inicio) >= agoraMesmo)
          .slice(0, QUANTOS_AGENDAMENTOS)
        if (proximos.length === 0) return <Vazio>Nenhum agendamento nos próximos 30 dias.</Vazio>
        return (
          <ul className="flex flex-col divide-y divide-linha">
            {proximos.map((e) => {
              const detalhes = [TIPOS[e.tipo], e.modalidade && MODALIDADES[e.modalidade], e.local]
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={`${e.id}-${e.inicio}`}>
                  <Link to={`/agenda/${e.id}`} className="-mx-2 flex gap-3 rounded-lg px-2 py-2.5 hover:bg-suave/60">
                    <span className="flex w-24 shrink-0 flex-col text-base">
                      <span className="font-semibold first-letter:uppercase">{diaRelativo(diaDe(e.inicio))}</span>
                      <span className="text-muted-foreground tabular-nums">{horaDe(e.inicio)}</span>
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-bold">{e.titulo}</span>
                      <span className="text-base text-muted-foreground">{detalhes}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )
      }}
    </Bloco>
  )
}
