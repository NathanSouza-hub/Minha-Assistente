import {
  AirplaneTiltIcon,
  CalendarBlankIcon,
  CalendarDotsIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { areaDaRota } from '@/app/navegacao'
import { Abas } from '@/components/Abas'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Navegador } from '@/components/NavegadorDia'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEventos } from '@/consultas/eventos'
import { useViagens } from '@/consultas/viagens'
import {
  dataCurta,
  deDataISO,
  diasDaSemana,
  hojeISO,
  inicioDaSemana,
  mesDe,
  nomeDoMes,
  rotuloDoDia,
  somarDias,
  somarMeses,
} from '@/lib/datas'
import type { Evento, Viagem } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { ItemEvento } from './ItemEvento'
import { NovoNaAgenda } from './NovoNaAgenda'
import { eventosDoDia, porDia } from './porDia'
import { AREAS_DO_TIPO } from './textos'

type Visao = 'mes' | 'semana' | 'lista'

const DIAS_DA_LISTA = 30
/** O calendário sempre mostra 6 semanas: a altura não pula de um mês para outro. */
const DIAS_DO_CALENDARIO = 42

/** O dia escolhido mora na URL (`?data=`); a visão é a aba (`?visao=`). */
function useDia() {
  const [params, setParams] = useSearchParams()
  const data = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') ?? '') ? params.get('data')! : hojeISO()
  const mudar = (dia: string) =>
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual)
        if (dia === hojeISO()) novo.delete('data')
        else novo.set('data', dia)
        return novo
      },
      { replace: true },
    )
  return { data, mudar }
}

/** Viagens que passam pelo dia (da ida à volta; sem volta, só o dia da ida). */
const viagensDoDia = (viagens: Viagem[], dia: string) =>
  viagens.filter((v) => v.ida <= dia && dia <= (v.volta ?? v.ida))

/** Cor do ponto de cada agendamento: a área do tipo (rádio, saúde...) ou a da Agenda. */
const areaDoEvento = (e: Evento) => areaDaRota(AREAS_DO_TIPO.find((a) => a.tipo === e.tipo)?.rota ?? '/agenda')

export function Agenda() {
  const { data, mudar } = useDia()
  return (
    <Pagina titulo="Agenda" larga acoes={<NovoNaAgenda data={data === hojeISO() ? '' : data} />}>
      <Abas<Visao>
        rotulo="Formas de ver a agenda"
        parametro="visao"
        abas={[
          { valor: 'mes', rotulo: 'Mês', conteudo: <VisaoMes data={data} mudar={mudar} /> },
          { valor: 'semana', rotulo: 'Semana', conteudo: <VisaoSemana data={data} mudar={mudar} /> },
          { valor: 'lista', rotulo: 'Próximos', conteudo: <VisaoProximos /> },
        ]}
      />
    </Pagina>
  )
}

/** Calendário do mês (agendamentos e viagens marcados) e, ao lado ou embaixo, o que há no dia escolhido. */
function VisaoMes({ data, mudar }: { data: string; mudar: (dia: string) => void }) {
  const mes = mesDe(data)
  const primeiro = inicioDaSemana(`${mes}-01`)
  const consulta = useEventos({ inicio: primeiro, fim: somarDias(primeiro, DIAS_DO_CALENDARIO - 1) })
  const { data: viagens = [] } = useViagens()
  const eventos = consulta.data ?? []
  // Trocar de mês abre o dia 1 (ou hoje, no mês atual).
  const irPara = (novoMes: string) => mudar(novoMes === mesDe() ? hojeISO() : `${novoMes}-01`)
  const doDia = eventosDoDia(eventos, data)
  const viagensDia = viagensDoDia(viagens, data)

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section aria-label="Calendário" className="superficie flex flex-col gap-3 p-3 sm:p-4">
        <nav aria-label="Mês" className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" onClick={() => irPara(somarMeses(mes, -1))} aria-label="Mês anterior">
            <CaretLeftIcon className="size-7" weight="bold" aria-hidden />
          </Button>
          <h2 className="text-secao font-bold" aria-live="polite">
            {nomeDoMes(mes)}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => irPara(somarMeses(mes, 1))} aria-label="Próximo mês">
            <CaretRightIcon className="size-7" weight="bold" aria-hidden />
          </Button>
        </nav>
        <Calendario mes={mes} primeiro={primeiro} escolhido={data} eventos={eventos} viagens={viagens} aoEscolher={mudar} />
        {data !== hojeISO() && (
          <Button variant="link" className="self-center" onClick={() => mudar(hojeISO())}>
            Voltar para hoje
          </Button>
        )}
      </section>

      <section aria-labelledby="titulo-do-dia" className="flex flex-col gap-2">
        <h2 id="titulo-do-dia" className="text-secao font-bold">
          {rotuloDoDia(data)}
        </h2>
        {consulta.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Carregando agenda">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : consulta.isError ? (
          <EstadoVazio
            icone={CalendarDotsIcon}
            titulo="Não foi possível carregar a agenda"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          >
            Verifique a internet e tente de novo.
          </EstadoVazio>
        ) : doDia.length === 0 && viagensDia.length === 0 ? (
          <EstadoVazio icone={CalendarDotsIcon} titulo="Nada marcado para este dia">
            Toque em "Novo" para agendar alguma coisa neste dia.
          </EstadoVazio>
        ) : (
          <div className="flex flex-col gap-3">
            {viagensDia.length > 0 && <ListaViagens viagens={viagensDia} dia={data} />}
            {doDia.length > 0 && <ListaEventos eventos={doDia} rotulo={`Agendamentos de ${rotuloDoDia(data)}`} />}
          </div>
        )}
      </section>
    </div>
  )
}

/** Grade de 6 semanas (segunda a domingo); cada dia mostra até 3 pontos na cor do que tem nele. */
function Calendario({
  mes,
  primeiro,
  escolhido,
  eventos,
  viagens,
  aoEscolher,
}: {
  mes: string
  primeiro: string
  escolhido: string
  eventos: Evento[]
  viagens: Viagem[]
  aoEscolher: (dia: string) => void
}) {
  const hoje = hojeISO()
  const dias = Array.from({ length: DIAS_DO_CALENDARIO }, (_, i) => somarDias(primeiro, i))
  return (
    <div role="grid" aria-label={`Dias de ${nomeDoMes(mes).toLowerCase()}`} className="flex flex-col gap-1">
      <div role="row" className="grid grid-cols-7">
        {diasDaSemana(primeiro).map((dia) => (
          <span
            key={dia}
            role="columnheader"
            className="py-1 text-center text-sm font-semibold text-muted-foreground first-letter:uppercase"
          >
            {/* "seg." -> "Seg" */}
            {deDataISO(dia).toFormat('ccc').replace('.', '')}
          </span>
        ))}
      </div>
      {Array.from({ length: DIAS_DO_CALENDARIO / 7 }, (_, semana) => (
        <div key={semana} role="row" className="grid grid-cols-7 gap-1">
          {dias.slice(semana * 7, semana * 7 + 7).map((dia) => {
            const doDia = eventosDoDia(eventos, dia)
            const viagensDia = viagensDoDia(viagens, dia)
            const quantos = doDia.length + viagensDia.length
            const pontos = [...viagensDia.map(() => 'viagens'), ...doDia.map(areaDoEvento)].slice(0, 3)
            const aberto = dia === escolhido
            const foraDoMes = mesDe(dia) !== mes
            return (
              <div key={dia} role="gridcell" aria-selected={aberto}>
                <button
                  type="button"
                  onClick={() => aoEscolher(dia)}
                  aria-pressed={aberto}
                  aria-label={`${rotuloDoDia(dia)}${quantos ? `, ${quantos} ${quantos === 1 ? 'compromisso' : 'compromissos'}` : ''}`}
                  className={cn(
                    'flex h-14 w-full flex-col items-center justify-center gap-1 rounded-xl text-lg font-semibold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-16',
                    aberto
                      ? 'bg-primary text-primary-foreground shadow-folha'
                      : dia === hoje
                        ? 'bg-secondary text-primary ring-2 ring-primary/30'
                        : 'hover:bg-suave',
                    foraDoMes && !aberto && 'text-muted-foreground/60',
                  )}
                >
                  {deDataISO(dia).day}
                  <span aria-hidden className="flex h-1.5 gap-1">
                    {pontos.map((area, i) => (
                      <span
                        key={i}
                        className={cn('size-1.5 rounded-full', aberto ? 'bg-primary-foreground' : `area-${area} bg-area`)}
                      />
                    ))}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Viagens do dia: abrem o detalhe da viagem (hospedagem, transporte e passagens). */
function ListaViagens({ viagens, dia }: { viagens: Viagem[]; dia: string }) {
  return (
    <ul className="superficie flex flex-col divide-y divide-linha overflow-hidden" aria-label={`Viagens de ${rotuloDoDia(dia)}`}>
      {viagens.map((v) => (
        <li key={v.id} className="area-viagens">
          <Link to={`/viagens/${v.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-suave/50">
            <AirplaneTiltIcon className="size-6 shrink-0 text-area" weight="fill" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="leading-snug font-semibold">Viagem: {v.destino}</span>
              <span className="text-apoio text-muted-foreground">
                {v.ida === dia ? 'Ida' : v.volta === dia ? 'Volta' : 'Em viagem'} ·{' '}
                {v.volta ? `${dataCurta(v.ida)} a ${dataCurta(v.volta)}` : dataCurta(v.ida)}
              </span>
            </span>
            <CaretRightIcon weight="bold" className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function ListaEventos({ eventos, rotulo, voltar }: { eventos: Evento[]; rotulo: string; voltar?: string }) {
  return (
    <ul className="superficie flex flex-col divide-y divide-linha overflow-hidden" aria-label={rotulo}>
      {eventos.map((e) => (
        <ItemEvento key={`${e.id}-${e.inicio}`} evento={e} voltar={voltar} />
      ))}
    </ul>
  )
}

export function CabecalhoDia({ dia }: { dia: string }) {
  return <h3 className="text-base font-bold">{rotuloDoDia(dia)}</h3>
}

function tituloSemana(segunda: string) {
  const ini = deDataISO(segunda)
  const fim = ini.plus({ days: 6 })
  return ini.month === fim.month
    ? `${ini.day} a ${fim.toFormat("d 'de' LLLL")}`
    : `${ini.toFormat("d 'de' LLL")} a ${fim.toFormat("d 'de' LLL")}`
}

/** Os 7 dias da semana do dia escolhido, inclusive os livres: dá a noção da semana inteira. */
function VisaoSemana({ data, mudar }: { data: string; mudar: (dia: string) => void }) {
  const segunda = inicioDaSemana(data)
  const consulta = useEventos({ inicio: segunda, fim: somarDias(segunda, 6) })
  const grupos = porDia(consulta.data ?? [], segunda)
  const estaSemana = segunda === inicioDaSemana(hojeISO())

  return (
    <div className="flex flex-col gap-5">
      <Navegador
        rotulo="Semana"
        titulo={tituloSemana(segunda)}
        anterior={{ rotulo: 'Semana anterior', ir: () => mudar(somarDias(data, -7)) }}
        proximo={{ rotulo: 'Próxima semana', ir: () => mudar(somarDias(data, 7)) }}
      />
      {!estaSemana && (
        <Button variant="link" className="-mt-4 h-11 self-start px-0" onClick={() => mudar(hojeISO())}>
          Voltar para hoje
        </Button>
      )}
      {consulta.isPending ? (
        <Skeleton className="h-48" role="status" aria-label="Carregando agenda" />
      ) : (
        diasDaSemana(segunda).map((dia) => {
          const doDia = grupos.get(dia) ?? []
          // Dia livre ocupa uma linha só: a semana cabe na tela.
          return doDia.length ? (
            <section key={dia} className="flex flex-col gap-2">
              <CabecalhoDia dia={dia} />
              <ListaEventos eventos={doDia} rotulo={`Agendamentos de ${rotuloDoDia(dia)}`} />
            </section>
          ) : (
            <section key={dia} className="flex flex-wrap items-baseline justify-between gap-x-4">
              <CabecalhoDia dia={dia} />
              <p className="text-base text-muted-foreground">Nada marcado.</p>
            </section>
          )
        })
      )}
    </div>
  )
}

/** Próximos 30 dias, só os dias com agendamento. */
function VisaoProximos() {
  const inicio = hojeISO()
  const consulta = useEventos({ inicio, fim: somarDias(inicio, DIAS_DA_LISTA) })
  const eventos = consulta.data ?? []
  if (consulta.isPending) return <Skeleton className="h-48" role="status" aria-label="Carregando agenda" />
  if (eventos.length === 0) {
    return (
      <EstadoVazio icone={CalendarBlankIcon} titulo={`Nada marcado nos próximos ${DIAS_DA_LISTA} dias`}>
        Toque em "Novo" para agendar.
      </EstadoVazio>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {[...porDia(eventos, inicio)].map(([dia, doDia]) => (
        <section key={dia} className="flex flex-col gap-2">
          <CabecalhoDia dia={dia} />
          <ListaEventos eventos={doDia} rotulo={`Agendamentos de ${rotuloDoDia(dia)}`} />
        </section>
      ))}
    </div>
  )
}
