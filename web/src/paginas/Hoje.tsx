import { SunIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { useSessao } from '@/app/useSessao'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { NavegadorDia } from '@/components/NavegadorDia'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTarefasHoje } from '@/consultas/hoje'
import { agora, dataPorExtenso, hojeISO } from '@/lib/datas'
import type { TarefaHoje, TarefasHoje } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { LinhaTarefa } from '@/paginas/hoje/LinhaTarefa'

/** "Bom dia" até o meio-dia, "Boa tarde" até as 18h, "Boa noite" depois (e de madrugada). */
function saudacao(hora: number) {
  if (hora >= 5 && hora < 12) return 'Bom dia'
  if (hora >= 12 && hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** "Bom dia, Maria", a data por extenso e o resumo do dia, na capa. */
function CabecalhoHoje({ resumo }: { resumo: string | null }) {
  const { usuario } = useSessao()
  const hoje = agora()
  const primeiroNome = usuario?.nome.trim().split(/\s+/)[0]
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[2rem] leading-tight font-[750] tracking-[-0.01em] md:text-[2.5rem]">
        {saudacao(hoje.hour)}
        {primeiroNome && `, ${primeiroNome}`}
      </h1>
      <p className="text-lg font-semibold text-muted-foreground">{dataPorExtenso(hoje.toISODate()!)}</p>
      {resumo && (
        <p className="mt-2 max-w-prose text-lg" aria-live="polite">
          {resumo}
        </p>
      )}
    </div>
  )
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** "Para hoje: 9 tarefas, 2 concluídas e 3 atrasadas." */
function frase(r: TarefasHoje['resumo'], ehHoje: boolean) {
  if (r.programadas === 0) return null
  const partes = [
    plural(r.programadas, 'tarefa', 'tarefas'),
    r.concluidas > 0 && plural(r.concluidas, 'concluída', 'concluídas'),
    r.atrasadas > 0 && plural(r.atrasadas, 'atrasada', 'atrasadas'),
  ].filter(Boolean) as string[]
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`
  return `${ehHoje ? 'Para hoje' : 'Neste dia'}: ${lista}.`
}

export function Hoje() {
  const [params, setParams] = useSearchParams()
  const data = params.get('data') ?? hojeISO()
  const ehHoje = data === hojeISO()
  const consulta = useTarefasHoje(data)
  const mudarDia = (novo: string) => setParams(novo === hojeISO() ? {} : { data: novo }, { replace: true })

  return (
    <Pagina
      titulo="Hoje"
      cabecalho={<CabecalhoHoje resumo={consulta.data ? frase(consulta.data.resumo, ehHoje) : null} />}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <NavegadorDia data={data} aoMudar={mudarDia} />
          <label className="flex items-center justify-center gap-3 text-base text-muted-foreground">
            Ir para o dia
            <input
              type="date"
              value={data}
              onChange={(e) => e.target.value && mudarDia(e.target.value)}
              className="min-h-11 rounded-lg border border-input bg-folha px-3 text-base text-foreground"
            />
          </label>
        </div>

        {consulta.isPending ? (
          <div role="status" aria-label="Carregando o dia" className="flex flex-col gap-4">
            <Skeleton className="h-24" />
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-16" />
            ))}
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
          <TarefasDoDia dia={consulta.data} ehHoje={ehHoje} />
        )}
      </div>
    </Pagina>
  )
}

/** Os quatro números do dia, cada um na sua cor. */
function ResumoDia({ resumo }: { resumo: TarefasHoje['resumo'] }) {
  const contadores = [
    { rotulo: 'Programadas', valor: resumo.programadas, cor: 'area-viagens text-area bg-area-fundo' },
    { rotulo: 'Concluídas', valor: resumo.concluidas, cor: 'text-ok bg-ok-fundo' },
    { rotulo: 'Pendentes', valor: resumo.pendentes, cor: 'area-compromissos text-area bg-area-fundo' },
    { rotulo: 'Atrasadas', valor: resumo.atrasadas, cor: 'text-atraso bg-atraso-fundo' },
  ]
  return (
    <section aria-label="Resumo do dia">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {contadores.map((c) => (
          <div key={c.rotulo} className={cn('flex flex-col rounded-xl px-4 py-3', c.cor)}>
            <dt className="text-base font-semibold">{c.rotulo}</dt>
            <dd className="text-3xl leading-tight font-[750] tabular-nums">{c.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function TarefasDoDia({ dia, ehHoje }: { dia: TarefasHoje; ehHoje: boolean }) {
  if (dia.tarefas.length === 0) {
    return (
      <EstadoVazio
        icone={SunIcon}
        titulo={ehHoje ? 'Nada programado para hoje.' : 'Nada programado para este dia.'}
        acao={
          <Button asChild>
            <Link to="/agenda/novo">Novo agendamento</Link>
          </Button>
        }
      />
    )
  }

  const comHorario = dia.tarefas.filter((t) => t.horario)
  const diaTodo = dia.tarefas.filter((t) => !t.horario)
  const lista = (tarefas: TarefaHoje[]) => (
    <ul className="flex flex-col divide-y divide-linha">
      {tarefas.map((t) => (
        <LinhaTarefa key={t.id} tarefa={t} data={dia.data} />
      ))}
    </ul>
  )

  return (
    <div className="flex flex-col gap-6">
      <ResumoDia resumo={dia.resumo} />
      <section aria-labelledby="hoje-tarefas" className="flex flex-col gap-1">
        <h2 id="hoje-tarefas" className="text-xl font-bold">
          Tarefas do dia
        </h2>
        {comHorario.length > 0 && lista(comHorario)}
        {diaTodo.length > 0 && (
          <>
            <h3 className="mt-4 text-base font-bold tracking-wide text-muted-foreground uppercase">Dia todo</h3>
            {lista(diaTodo)}
          </>
        )}
      </section>
    </div>
  )
}
