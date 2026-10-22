import { CaretLeftIcon, CaretRightIcon, CheckIcon, GearSixIcon, SunIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { useSessao } from '@/app/useSessao'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTarefasHoje } from '@/consultas/hoje'
import { agora, dataPorExtenso, hojeISO, rotuloDoDia, saudacao, somarDias } from '@/lib/datas'
import type { TarefaHoje, TarefasHoje } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { LinhaTarefa } from '@/paginas/hoje/LinhaTarefa'
import { CATEGORIAS, destaqueDoDia, useMarcar } from '@/paginas/hoje/tarefas'
import { NovaAtividade } from '@/paginas/hoje/NovaAtividade'

/** Data, saudação, "+ Nova" e a conta; embaixo, a barra fina de progresso do dia aberto. */
function CabecalhoHoje({ resumo }: { resumo: TarefasHoje['resumo'] | null }) {
  const { usuario } = useSessao()
  const hoje = agora()
  const primeiroNome = usuario?.nome.trim().split(/\s+/)[0]
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {/* Data e ações numa linha; a saudação embaixo, com a largura toda, para caber numa linha só. */}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-apoio font-medium text-muted-foreground">{dataPorExtenso(hoje.toISODate()!)}</p>
        <div className="flex shrink-0 items-center gap-2">
          <NovaAtividade />
          {/* No celular, Configurações não cabe na barra de baixo: fica aqui. */}
          <Button asChild variant="outline" size="icon" aria-label="Configurações" className="rounded-full md:hidden">
            <Link to="/configuracoes">
              <GearSixIcon className="size-6" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
      <h1 className="-mt-1 text-[1.5rem] leading-tight font-bold tracking-[-0.02em] min-[380px]:text-titulo">
        {saudacao(hoje.hour)}
        {primeiroNome && `, ${primeiroNome}`}
      </h1>
      {resumo && resumo.programadas > 0 && (
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Atividades feitas"
            aria-valuenow={resumo.concluidas}
            aria-valuemin={0}
            aria-valuemax={resumo.programadas}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-contorno/70"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
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
    <Pagina titulo="Início" cabecalho={<CabecalhoHoje resumo={consulta.data?.resumo ?? null} />}>
      {consulta.isPending ? (
        <div role="status" aria-label="Carregando o dia" className="flex flex-col gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
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

  return (
    <div className="flex flex-col gap-6">
      {destaque && <Agora destaque={destaque} data={dia.data} />}

      {atrasadas.length > 0 && (
        <section aria-labelledby="hoje-atrasadas" className="flex flex-col gap-2">
          <h2 id="hoje-atrasadas" className="flex items-center gap-1.5 text-base font-bold text-atraso">
            <WarningCircleIcon weight="bold" className="size-5" aria-hidden />
            Atrasadas
          </h2>
          {lista(atrasadas)}
        </section>
      )}

      <section aria-label={ehHoje ? 'Atividades de hoje' : 'Atividades do dia'} className="flex flex-col gap-2">
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

        <label className="mt-2 flex items-center gap-3 text-apoio text-muted-foreground">
          Ir para o dia
          <input
            type="date"
            value={dia.data}
            onChange={(e) => e.target.value && aoMudarDia(e.target.value)}
            className="min-h-11 rounded-lg border border-input bg-folha px-3 text-base text-foreground"
          />
        </label>
      </section>
    </div>
  )
}

/** O único bloco em destaque da tela: o que fazer agora, com "Feito" e, embaixo, "Não fiz" e o que vem depois. */
function Agora({ destaque, data }: { destaque: NonNullable<ReturnType<typeof destaqueDoDia>>; data: string }) {
  const { tarefa: t, acontecendo, depois } = destaque
  const marcarComo = useMarcar(t, data)
  const { feito, naoFeito } = CATEGORIAS[t.categoria]
  return (
    <section aria-labelledby="hoje-agora" className="rounded-2xl bg-folha px-4 pt-4 pb-1 shadow-[var(--shadow-destaque)]">
      <div className="flex items-center gap-3">
        <Link to={t.link} className="min-w-0 flex-1">
          <p id="hoje-agora" className="flex items-center gap-2 text-[0.85rem] font-semibold text-primary">
            <span aria-hidden className="size-2 rounded-full bg-primary shadow-[0_0_0_4px_var(--azul-fundo)]" />
            {acontecendo ? 'Agora' : 'Próxima'} · {t.horario}
          </p>
          <h2 className="mt-1 text-destaque font-bold break-words">{t.titulo}</h2>
          {t.detalhe && <p className="mt-0.5 text-apoio text-muted-foreground">{t.detalhe}</p>}
        </Link>
        <Button onClick={() => marcarComo('feito')} aria-label={`${feito}: ${t.titulo}`} className="shrink-0 px-4">
          <CheckIcon weight="bold" aria-hidden />
          {feito}
        </Button>
      </div>
      <div className={cn('mt-3 flex items-center gap-3 border-t border-linha', depois ? 'justify-between' : 'justify-start')}>
        <button
          type="button"
          onClick={() => marcarComo('nao_feito')}
          className="min-h-11 shrink-0 text-apoio font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {naoFeito}
          <span className="sr-only">: {t.titulo}</span>
        </button>
        {depois && (
          <Link
            to={depois.link}
            className="flex min-h-11 min-w-0 items-center gap-1.5 text-apoio hover:underline"
          >
            <span className="shrink-0 text-muted-foreground">Depois:</span>
            <span className="truncate font-semibold">
              {depois.horario} {depois.titulo}
            </span>
            <CaretRightIcon weight="bold" className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )}
      </div>
    </section>
  )
}
