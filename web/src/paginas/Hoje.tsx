import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon, CheckIcon, GearSixIcon, SunIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { useSessao } from '@/app/useSessao'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTarefasHoje } from '@/consultas/hoje'
import { SeletorDia } from '@/components/SeletorPeriodo'
import { agora, dataCurta, dataPorExtenso, hojeISO, rotuloDoDia, saudacao, somarDias } from '@/lib/datas'
import type { TarefaHoje, TarefasHoje } from '@/lib/tipos'
import { LinhaTarefa } from '@/paginas/hoje/LinhaTarefa'
import { CATEGORIAS, destaqueDoDia, useMarcar } from '@/paginas/hoje/tarefas'
import { NovaAtividade } from '@/paginas/hoje/NovaAtividade'
import { ResumoDasAreas } from '@/paginas/hoje/ResumoDasAreas'
import { VersoDoDia } from '@/paginas/hoje/VersoDoDia'

/** Data, saudação, "Ir para o dia", "+ Nova" e a conta; embaixo, a barra fina de progresso do dia aberto. */
function CabecalhoHoje({
  dia,
  data,
  ehHoje,
  aoMudarDia,
}: {
  dia: TarefasHoje | null
  data: string
  ehHoje: boolean
  aoMudarDia: (data: string) => void
}) {
  const resumo = dia?.resumo ?? null
  const { usuario } = useSessao()
  const hoje = agora()
  const primeiroNome = usuario?.nome.trim().split(/\s+/)[0]
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {/* Data e ações numa linha; a saudação embaixo, com a largura toda, para caber numa linha só. */}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-apoio font-medium text-muted-foreground">{dataPorExtenso(hoje.toISODate()!)}</p>
        <div className="flex shrink-0 items-center gap-2">
          {/* "Ir para o dia": no celular só o calendário (a data escrita não cabe ao lado do "+ Nova"). */}
          <SeletorDia
            data={data}
            aoMudar={aoMudarDia}
            rotulo="Ir para o dia"
            gatilho={
              <Button variant="outline" aria-label={`Ir para o dia (${dataCurta(data)})`} className="size-12 rounded-full px-0 sm:w-auto sm:px-4">
                <CalendarBlankIcon className="size-6 sm:size-5" aria-hidden />
                <span className="hidden sm:inline">{dataCurta(data)}</span>
              </Button>
            }
          />
          <NovaAtividade />
          {/* No celular, Configurações não cabe na barra de baixo: fica aqui. */}
          <Button asChild variant="outline" size="icon" aria-label="Configurações" className="rounded-full md:hidden">
            <Link to="/configuracoes">
              <GearSixIcon className="size-6" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
      <h1 className="-mt-1 text-[1.9rem] leading-[1.02] font-bold tracking-[-0.03em] min-[380px]:text-[2.15rem] md:text-[2.6rem]">
        {saudacao(hoje.hour)}
        {primeiroNome && `, ${primeiroNome}`}
      </h1>
      {dia && ehHoje && <FraseDoDia dia={dia} />}
      {resumo && resumo.programadas > 0 && (
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Atividades feitas"
            aria-valuenow={resumo.concluidas}
            aria-valuemin={0}
            aria-valuemax={resumo.programadas}
            className="h-2 flex-1 overflow-hidden rounded-full bg-contorno/60"
          >
            <div
              className="h-full rounded-full bg-grafite transition-[width]"
              style={{ width: `${(resumo.concluidas / resumo.programadas) * 100}%` }}
            />
          </div>
          <span className="text-apoio font-semibold text-muted-foreground" aria-live="polite">
            {resumo.concluidas} de {resumo.programadas} feitas
          </span>
        </div>
      )}
    </div>
  )
}

export function Hoje() {
  const [params, setParams] = useSearchParams()
  const data = params.get('data') ?? hojeISO()
  const ehHoje = data === hojeISO()
  const consulta = useTarefasHoje(data)
  const mudarDia = (novo: string) => setParams(novo === hojeISO() ? {} : { data: novo }, { replace: true })

  return (
    <Pagina titulo="Início" larga cabecalho={<CabecalhoHoje dia={consulta.data ?? null} data={data} ehHoje={ehHoje} aoMudarDia={mudarDia} />}
    >
      {consulta.isPending ? (
        <div role="status" aria-label="Carregando o dia" className="flex flex-col gap-4">
          <Skeleton className="h-40 rounded-[1.75rem]" />
          <Skeleton className="h-64 rounded-[1.5rem]" />
        </div>
      ) : consulta.isError ? (
        <EstadoVazio
          icone={SunIcon}
          titulo="Não foi possível carregar o seu dia"
          acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
        >
          Verifique a internet e tente de novo.
        </EstadoVazio>
      ) : (
        <TarefasDoDia dia={consulta.data} ehHoje={ehHoje} aoMudarDia={mudarDia} />
      )}
    </Pagina>
  )
}

function TarefasDoDia({ dia, ehHoje, aoMudarDia }: { dia: TarefasHoje; ehHoje: boolean; aoMudarDia: (data: string) => void }) {
  const hora = agora()
  const destaque = ehHoje ? destaqueDoDia(dia.tarefas, hora.hour * 60 + hora.minute) : null
  const agoraId = destaque?.acontecendo ? destaque.tarefa.id : null

  // As atrasadas (o horário já passou, conta vencida, lembrete de outro dia) ficam em cima, à parte;
  // a que está acontecendo agora vai para o destaque.
  const atrasadas = dia.tarefas.filter((t) => t.status === 'atrasado' && t.id !== agoraId)
  const noDia = dia.tarefas.filter((t) => t.status !== 'atrasado' || t.id === agoraId)
  const comHorario = noDia.filter((t) => t.horario)
  const diaTodo = noDia.filter((t) => !t.horario)
  const lista = (tarefas: TarefaHoje[]) => (
    <ul className="superficie flex flex-col divide-y divide-linha">
      {tarefas.map((t) => (
        <LinhaTarefa key={t.id} tarefa={t} data={dia.data} agora={t.id === agoraId} />
      ))}
    </ul>
  )

  // Celular: Agora, o resumo das áreas e o verso, depois as listas. Computador: listas à esquerda e
  // o resumo com o verso numa coluna à direita.
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-8">
      {destaque && (
        <div className="lg:col-start-1">
          <Agora destaque={destaque} data={dia.data} />
        </div>
      )}

      <aside
        aria-label="Resumo do dia"
        className="flex flex-col gap-3 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-3 lg:row-start-1"
      >
        <ResumoDasAreas dia={dia} ehHoje={ehHoje} />
        <VersoDoDia data={dia.data} />
      </aside>

      {atrasadas.length > 0 && (
        <section aria-labelledby="hoje-atrasadas" className="flex flex-col gap-2 lg:col-start-1">
          <h2 id="hoje-atrasadas" className="flex items-center gap-1.5 text-base font-bold text-atraso">
            <WarningCircleIcon weight="bold" className="size-5" aria-hidden />
            Atrasadas
          </h2>
          {lista(atrasadas)}
        </section>
      )}

      <section id="hoje-lista" aria-label={ehHoje ? 'Atividades de hoje' : 'Atividades do dia'} className="flex flex-col gap-2 lg:col-start-1">
        <nav aria-label="Dia" className="flex items-center justify-between gap-2">
          <h2 className="text-secao font-bold" aria-live="polite">
            {rotuloDoDia(dia.data)}
          </h2>
          <div className="flex shrink-0">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => aoMudarDia(somarDias(dia.data, -1))} aria-label="Dia anterior">
              <CaretLeftIcon className="size-6" weight="bold" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => aoMudarDia(somarDias(dia.data, 1))} aria-label="Próximo dia">
              <CaretRightIcon className="size-6" weight="bold" aria-hidden />
            </Button>
          </div>
        </nav>
        {!ehHoje && (
          <Button variant="link" className="h-11 self-start px-0" onClick={() => aoMudarDia(hojeISO())}>
            Voltar para hoje
          </Button>
        )}

        {dia.tarefas.length === 0 ? (
          <EstadoVazio
            icone={SunIcon}
            titulo={ehHoje ? 'Nada programado para hoje.' : 'Nada programado para este dia.'}
            acao={<NovaAtividade />}
          />
        ) : (
          <>
            {noDia.length === 0 && <p className="text-muted-foreground">Nada mais para este dia.</p>}
            {comHorario.length > 0 && lista(comHorario)}
            {diaTodo.length > 0 && (
              <>
                <h3 className="mt-3 text-apoio font-semibold text-muted-foreground">Dia todo</h3>
                {lista(diaTodo)}
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}

/**
 * O único bloco em destaque da tela, em azul-noite com a lua âmbar: o que fazer agora, o botão de
 * concluir em âmbar e, embaixo, "Não fiz" e o que vem depois.
 */
function Agora({ destaque, data }: { destaque: NonNullable<ReturnType<typeof destaqueDoDia>>; data: string }) {
  const { tarefa: t, acontecendo, depois } = destaque
  const marcarComo = useMarcar(t, data)
  const { feito, naoFeito } = CATEGORIAS[t.categoria]
  return (
    <section
      aria-labelledby="hoje-agora"
      className="relative overflow-hidden rounded-[1.75rem] bg-noite px-5 pt-5 pb-2 text-white shadow-[var(--shadow-destaque)]"
    >
      {/* Lua: um círculo âmbar recortado por outro da cor do bloco. */}
      <span aria-hidden className="absolute -top-8 -right-6 size-30 rounded-full bg-ambar/90" />
      <span aria-hidden className="absolute -top-11 right-0 size-28 rounded-full bg-noite" />
      <div className="relative">
        <Link to={t.link} className="block min-w-0 rounded-lg focus-visible:outline-white">
          <p
            id="hoje-agora"
            className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-[0.8rem] font-bold tracking-[0.04em]"
          >
            {acontecendo ? 'Agora' : 'Próxima'} · {t.horario}
          </p>
          <h2 className="mt-3 pr-16 text-[1.85rem] leading-[1.08] font-bold tracking-[-0.025em] break-words">
            {t.titulo}
          </h2>
          {t.detalhe && <p className="mt-1 text-base text-noite-texto">{t.detalhe}</p>}
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
          <Button
            onClick={() => marcarComo('feito')}
            aria-label={`${feito}: ${t.titulo}`}
            className="h-12 bg-ambar px-6 text-[1.05rem] font-bold text-grafite hover:bg-[color-mix(in_oklab,var(--ambar),white_18%)]"
          >
            <CheckIcon weight="bold" aria-hidden />
            {feito}
          </Button>
          <button
            type="button"
            onClick={() => marcarComo('nao_feito')}
            className="min-h-11 shrink-0 text-base font-semibold text-noite-texto underline underline-offset-4 hover:text-white"
          >
            {naoFeito}
            <span className="sr-only">: {t.titulo}</span>
          </button>
        </div>
        {depois && (
          <Link
            to={depois.link}
            className="mt-3 flex min-h-11 min-w-0 items-center gap-1.5 border-t border-white/12 text-apoio hover:underline"
          >
            <span className="shrink-0 text-noite-texto">Depois:</span>
            <span className="truncate font-semibold">
              {depois.horario} {depois.titulo}
            </span>
            <CaretRightIcon weight="bold" className="size-4 shrink-0 text-noite-texto" aria-hidden />
          </Link>
        )}
      </div>
    </section>
  )
}

/** A frase de assistente embaixo da saudação, só com o que está na lista do dia. */
function FraseDoDia({ dia }: { dia: TarefasHoje }) {
  const hora = agora()
  const destaque = destaqueDoDia(dia.tarefas, hora.hour * 60 + hora.minute)
  const atrasadas = dia.tarefas.filter((t) => t.status === 'atrasado' && t.id !== destaque?.tarefa.id).length
  const { programadas, concluidas } = dia.resumo
  let frase: string
  if (programadas === 0) frase = 'Nada marcado para hoje por enquanto.'
  else if (destaque?.acontecendo) frase = `Agora é a hora de ${destaque.tarefa.titulo}.`
  else if (destaque) frase = `A próxima é ${destaque.tarefa.titulo}, às ${destaque.tarefa.horario}.`
  else if (concluidas === programadas) frase = 'Tudo o que estava marcado para hoje foi feito.'
  else frase = 'Não há mais nada com horário hoje.'
  return (
    <p className="max-w-[40rem] text-base leading-snug text-muted-foreground md:text-[1.1rem]">
      {frase}
      {atrasadas > 0 && (
        <>
          {' '}
          <a href="#hoje-atrasadas" className="font-bold text-atraso underline-offset-4 hover:underline">
            {atrasadas === 1 ? '1 ficou para trás' : `${atrasadas} ficaram para trás`}
          </a>
          .
        </>
      )}
    </p>
  )
}
