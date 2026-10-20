import { GearSixIcon, SunIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { useSessao } from '@/app/useSessao'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { NavegadorDia } from '@/components/NavegadorDia'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTarefasHoje } from '@/consultas/hoje'
import { agora, dataPorExtenso, hojeISO, saudacao } from '@/lib/datas'
import type { TarefaHoje, TarefasHoje } from '@/lib/tipos'
import { LinhaTarefa } from '@/paginas/hoje/LinhaTarefa'
import { NovaAtividade } from '@/paginas/hoje/NovaAtividade'

/** Saudação discreta, a data de hoje como título e o resumo do dia, na capa. */
function CabecalhoHoje({ resumo }: { resumo: string | null }) {
  const { usuario } = useSessao()
  const hoje = agora()
  const primeiroNome = usuario?.nome.trim().split(/\s+/)[0]
  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      {/* Saudação discreta com os botões na mesma linha: a data fica com a largura toda. */}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-lg font-semibold text-muted-foreground">
          {saudacao(hoje.hour)}
          {primeiroNome && `, ${primeiroNome}`}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {/* No celular, Configurações não cabe na barra de baixo: fica aqui. */}
          <Button asChild variant="ghost" size="icon" aria-label="Configurações" className="md:hidden">
            <Link to="/configuracoes">
              <GearSixIcon className="size-6" weight="bold" aria-hidden />
            </Link>
          </Button>
          <NovaAtividade />
        </div>
      </div>
      <h1 className="text-[1.75rem] leading-tight font-[750] tracking-[-0.01em] md:text-[2.25rem]">
        {dataPorExtenso(hoje.toISODate()!)}
      </h1>
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
      titulo="Início"
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

function TarefasDoDia({ dia, ehHoje }: { dia: TarefasHoje; ehHoje: boolean }) {
  if (dia.tarefas.length === 0) {
    return (
      <EstadoVazio
        icone={SunIcon}
        titulo={ehHoje ? 'Nada programado para hoje.' : 'Nada programado para este dia.'}
        acao={<NovaAtividade />}
      />
    )
  }

  // As atrasadas (o horário já passou, conta vencida, lembrete de outro dia) ficam em cima, à parte.
  const atrasadas = dia.tarefas.filter((t) => t.status === 'atrasado')
  const noDia = dia.tarefas.filter((t) => t.status !== 'atrasado')
  const comHorario = noDia.filter((t) => t.horario)
  const diaTodo = noDia.filter((t) => !t.horario)
  const lista = (tarefas: TarefaHoje[]) => (
    <ul className="flex flex-col divide-y divide-linha">
      {tarefas.map((t) => (
        <LinhaTarefa key={t.id} tarefa={t} data={dia.data} />
      ))}
    </ul>
  )

  return (
    <div className="flex flex-col gap-6">
      {atrasadas.length > 0 && (
        <section aria-labelledby="hoje-atrasadas" className="flex flex-col gap-1">
          <h2 id="hoje-atrasadas" className="text-xl font-bold text-atraso">
            Atrasadas
          </h2>
          {lista(atrasadas)}
        </section>
      )}
      <section aria-labelledby="hoje-tarefas" className="flex flex-col gap-1">
        <h2 id="hoje-tarefas" className="text-xl font-bold">
          {ehHoje ? 'Atividades de hoje' : 'Atividades do dia'}
        </h2>
        {noDia.length === 0 && <p className="text-muted-foreground">Nada mais para este dia.</p>}
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
