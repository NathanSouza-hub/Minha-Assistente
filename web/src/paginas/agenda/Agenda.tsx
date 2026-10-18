import { CalendarDotsIcon, CaretLeftIcon, CaretRightIcon, PlusIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEventos } from '@/consultas/eventos'
import { deDataISO, diasDaSemana, hojeISO, inicioDaSemana, rotuloDoDia, somarDias } from '@/lib/datas'
import type { Evento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { ItemEvento } from './ItemEvento'
import { eventosDoDia, porDia } from './porDia'

type Visao = 'dia' | 'semana' | 'lista'

const DIAS_DA_LISTA = 30

/** Visão e dia moram na URL: recarregar ou voltar do formulário mantém o que estava aberto. */
function useNavegacao() {
  const [params, setParams] = useSearchParams()
  const visao = (['dia', 'semana', 'lista'] as const).find((v) => v === params.get('visao')) ?? 'dia'
  const data = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') ?? '') ? params.get('data')! : hojeISO()
  const mudar = (mudancas: { visao?: Visao; data?: string }) =>
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual)
        if (mudancas.visao) novo.set('visao', mudancas.visao)
        if (mudancas.data) {
          if (mudancas.data === hojeISO()) novo.delete('data')
          else novo.set('data', mudancas.data)
        }
        return novo
      },
      { replace: true },
    )
  return { visao, data, mudar }
}

/** O dia também busca a semana inteira: a faixa de dias marca quais têm agendamento. */
function periodo(visao: Visao, data: string) {
  if (visao !== 'lista') {
    const segunda = inicioDaSemana(data)
    return { inicio: segunda, fim: somarDias(segunda, 6) }
  }
  return { inicio: hojeISO(), fim: somarDias(hojeISO(), DIAS_DA_LISTA) }
}

function tituloSemana(segunda: string) {
  const ini = deDataISO(segunda)
  const fim = ini.plus({ days: 6 })
  return ini.month === fim.month
    ? `${ini.day} a ${fim.toFormat("d 'de' LLLL")}`
    : `${ini.toFormat("d 'de' LLL")} a ${fim.toFormat("d 'de' LLL")}`
}

export function Agenda() {
  const { visao, data, mudar } = useNavegacao()
  const { inicio, fim } = periodo(visao, data)
  const consulta = useEventos({ inicio, fim })
  const eventos = consulta.data ?? []
  const passo = visao === 'semana' ? 7 : 1
  const ehHoje = visao === 'dia' ? data === hojeISO() : inicio <= hojeISO() && hojeISO() <= fim

  return (
    <Pagina
      titulo="Agenda"
      acoes={
        <Button asChild size="lg">
          <Link to={`/agenda/novo${visao === 'dia' && data !== hojeISO() ? `?data=${data}` : ''}`}>
            <PlusIcon weight="bold" aria-hidden />
            Novo
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Opcoes<Visao>
          rotulo="Ver por"
          rotuloOculto
          formato="segmentos"
          valor={visao}
          aoMudar={(v) => mudar({ visao: v })}
          opcoes={[
            { valor: 'dia', rotulo: 'Dia' },
            { valor: 'semana', rotulo: 'Semana' },
            { valor: 'lista', rotulo: 'Próximos' },
          ]}
        />

        {visao !== 'lista' && (
          <div className="flex flex-col gap-2">
            <nav aria-label={visao === 'dia' ? 'Dia' : 'Semana'} className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => mudar({ data: somarDias(data, -passo) })}
                aria-label={visao === 'dia' ? 'Dia anterior' : 'Semana anterior'}
              >
                <CaretLeftIcon className="size-7" weight="bold" aria-hidden />
              </Button>
              <h2 className="text-center text-lg font-bold min-[400px]:text-xl" aria-live="polite">
                {visao === 'dia' ? rotuloDoDia(data) : tituloSemana(inicio)}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => mudar({ data: somarDias(data, passo) })}
                aria-label={visao === 'dia' ? 'Próximo dia' : 'Próxima semana'}
              >
                <CaretRightIcon className="size-7" weight="bold" aria-hidden />
              </Button>
            </nav>
            {visao === 'dia' && (
              <FaixaSemana data={data} eventos={eventos} aoEscolher={(dia) => mudar({ data: dia })} />
            )}
            {!ehHoje && (
              <Button variant="link" className="self-center" onClick={() => mudar({ data: hojeISO() })}>
                Voltar para hoje
              </Button>
            )}
          </div>
        )}

        {consulta.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Carregando agenda">
            {[1, 2].map((n) => (
              <Skeleton key={n} className="h-24" />
            ))}
          </div>
        ) : consulta.isError ? (
          <EstadoVazio
            icone={CalendarDotsIcon}
            titulo="Não foi possível carregar a agenda"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          >
            Verifique a internet e tente de novo.
          </EstadoVazio>
        ) : visao === 'dia' ? (
          eventosDoDia(eventos, data).length === 0 ? (
            <EstadoVazio
              icone={CalendarDotsIcon}
              titulo="Nada marcado para este dia"
              acao={
                <Button asChild>
                  <Link to={`/agenda/novo?data=${data}`}>Novo agendamento</Link>
                </Button>
              }
            >
              Quer agendar alguma coisa?
            </EstadoVazio>
          ) : (
            <ListaEventos eventos={eventosDoDia(eventos, data)} rotulo={`Agendamentos de ${rotuloDoDia(data)}`} />
          )
        ) : visao === 'semana' ? (
          <Semana eventos={eventos} segunda={inicio} />
        ) : (
          <Proximos eventos={eventos} />
        )}
      </div>
    </Pagina>
  )
}

export function ListaEventos({ eventos, rotulo, voltar }: { eventos: Evento[]; rotulo: string; voltar?: string }) {
  return (
    <ul className="flex flex-col divide-y divide-linha" aria-label={rotulo}>
      {eventos.map((e) => (
        <ItemEvento key={`${e.id}-${e.inicio}`} evento={e} voltar={voltar} />
      ))}
    </ul>
  )
}

/** Os 7 dias da semana do dia aberto, ao alcance do polegar; o ponto marca os dias com agendamento. */
function FaixaSemana({
  data,
  eventos,
  aoEscolher,
}: {
  data: string
  eventos: Evento[]
  aoEscolher: (dia: string) => void
}) {
  const hoje = hojeISO()
  return (
    <ol aria-label="Dias da semana" className="grid grid-cols-7 gap-1">
      {diasDaSemana(inicioDaSemana(data)).map((dia) => {
        const quantos = eventosDoDia(eventos, dia).length
        const aberto = dia === data
        // "seg." -> "Seg"
        const semana = deDataISO(dia).toFormat('ccc').replace('.', '')
        return (
          <li key={dia}>
            <button
              type="button"
              onClick={() => aoEscolher(dia)}
              aria-pressed={aberto}
              aria-label={`${rotuloDoDia(dia)}${quantos ? `, ${quantos} ${quantos === 1 ? 'agendamento' : 'agendamentos'}` : ''}`}
              className={cn(
                'flex h-[4.75rem] w-full flex-col items-center justify-center gap-1 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                aberto
                  ? 'bg-primary text-primary-foreground shadow-folha'
                  : dia === hoje
                    ? 'bg-terracota-clara text-terracota'
                    : 'hover:bg-areia',
              )}
            >
              <span className="text-[0.8rem] leading-none font-semibold first-letter:uppercase">{semana}</span>
              <span className="text-xl leading-none font-bold tabular-nums">{deDataISO(dia).day}</span>
              <span
                aria-hidden
                className={cn(
                  'size-1.5 rounded-full',
                  !quantos ? 'bg-transparent' : aberto ? 'bg-primary-foreground' : 'bg-current opacity-70',
                )}
              />
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function CabecalhoDia({ dia }: { dia: string }) {
  const hoje = dia === hojeISO()
  return (
    <h3 className={cn('flex items-center gap-2 text-lg font-bold', hoje && 'text-terracota')}>
      {hoje && <span aria-hidden className="h-5 w-1.5 rounded-full bg-hoje" />}
      {rotuloDoDia(dia)}
    </h3>
  )
}

/** Os 7 dias, inclusive os livres: dá a noção da semana inteira. */
function Semana({ eventos, segunda }: { eventos: Evento[]; segunda: string }) {
  const grupos = porDia(eventos, segunda)
  return (
    <div className="flex flex-col gap-5">
      {diasDaSemana(segunda).map((dia) => {
        const doDia = grupos.get(dia) ?? []
        // Dia livre ocupa uma linha só: a semana cabe na tela.
        return doDia.length ? (
          <section key={dia} className="flex flex-col gap-1">
            <CabecalhoDia dia={dia} />
            <ListaEventos eventos={doDia} rotulo={`Agendamentos de ${rotuloDoDia(dia)}`} />
          </section>
        ) : (
          <section key={dia} className="flex flex-wrap items-baseline justify-between gap-x-4">
            <CabecalhoDia dia={dia} />
            <p className="text-base text-muted-foreground">Nada marcado.</p>
          </section>
        )
      })}
    </div>
  )
}

/** Próximos 30 dias, só os dias com agendamento. */
function Proximos({ eventos }: { eventos: Evento[] }) {
  if (eventos.length === 0) {
    return (
      <EstadoVazio
        icone={CalendarDotsIcon}
        titulo={`Nada marcado nos próximos ${DIAS_DA_LISTA} dias`}
        acao={
          <Button asChild>
            <Link to="/agenda/novo">Novo agendamento</Link>
          </Button>
        }
      />
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {[...porDia(eventos, hojeISO())].map(([dia, doDia]) => (
        <section key={dia} className="flex flex-col gap-1">
          <CabecalhoDia dia={dia} />
          <ListaEventos eventos={doDia} rotulo={`Agendamentos de ${rotuloDoDia(dia)}`} />
        </section>
      ))}
    </div>
  )
}
