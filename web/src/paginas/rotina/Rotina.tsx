import { Check, ListChecks, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { NavegadorDia } from '@/components/NavegadorDia'
import { Opcoes } from '@/components/Opcoes'
import { Progresso } from '@/components/Progresso'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useConcluirTarefa, useRotinas, useTarefasDoDia } from '@/consultas/rotinas'
import { hojeISO, horaDe } from '@/lib/datas'
import type { TarefaDoDia } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { descreverDias } from './dias'

type Visao = 'dia' | 'todas'

export function Rotina() {
  const [params, setParams] = useSearchParams()
  const visao: Visao = params.get('visao') === 'todas' ? 'todas' : 'dia'
  const data = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') ?? '') ? params.get('data')! : hojeISO()

  const mudar = (chave: 'visao' | 'data', valor: string, padrao: string) =>
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual)
        if (valor === padrao) novo.delete(chave)
        else novo.set(chave, valor)
        return novo
      },
      { replace: true },
    )

  return (
    <Pagina
      titulo="Rotina"
      acoes={
        <Button asChild size="lg">
          <Link to="/rotina/nova">
            <Plus aria-hidden />
            Nova
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Opcoes<Visao>
          rotulo="Mostrar"
          rotuloOculto
          formato="segmentos"
          valor={visao}
          aoMudar={(v) => mudar('visao', v, 'dia')}
          opcoes={[
            { valor: 'dia', rotulo: 'Tarefas do dia' },
            { valor: 'todas', rotulo: 'Todas as tarefas' },
          ]}
        />
        {visao === 'dia' ? (
          <TarefasDoDia data={data} mudarData={(d) => mudar('data', d, hojeISO())} />
        ) : (
          <TodasAsTarefas />
        )}
      </div>
    </Pagina>
  )
}

function TarefasDoDia({ data, mudarData }: { data: string; mudarData: (d: string) => void }) {
  const consulta = useTarefasDoDia(data)
  const tarefas = consulta.data ?? []
  const feitas = tarefas.filter((t) => t.concluida).length
  const futuro = data > hojeISO()

  return (
    <>
      <NavegadorDia data={data} aoMudar={mudarData} />
      {consulta.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando tarefas">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : consulta.isError ? (
        <EstadoVazio
          icone={ListChecks}
          titulo="Não foi possível carregar a rotina"
          acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
        >
          Verifique a internet e tente de novo.
        </EstadoVazio>
      ) : tarefas.length === 0 ? (
        <EstadoVazio
          icone={ListChecks}
          titulo="Nenhuma tarefa para este dia"
          acao={
            <Button asChild>
              <Link to="/rotina/nova">Criar tarefa</Link>
            </Button>
          }
        >
          Tarefas da rotina são as que se repetem, como ler e-mails ou responder mensagens.
        </EstadoVazio>
      ) : (
        <>
          <Progresso
            feitos={feitas}
            total={tarefas.length}
            texto={`${feitas} de ${tarefas.length} ${tarefas.length === 1 ? 'tarefa feita' : 'tarefas feitas'}`}
            textoCompleto="Rotina do dia completa."
          />
          {futuro && <p className="text-base text-muted-foreground">Dá para marcar quando o dia chegar.</p>}
          <ul className="flex flex-col gap-3" aria-label="Tarefas do dia">
            {tarefas.map((t) => (
              <ItemTarefa key={t.rotinaId} tarefa={t} desabilitada={futuro} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

/** A linha inteira é a caixa de marcar: alvo grande para quem tem pouca precisão no toque. */
function ItemTarefa({ tarefa: t, desabilitada }: { tarefa: TarefaDoDia; desabilitada: boolean }) {
  const concluir = useConcluirTarefa(t.data)
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={t.concluida}
        disabled={desabilitada}
        onClick={() => concluir.mutate({ rotinaId: t.rotinaId, concluida: !t.concluida })}
        className={cn(
          'flex min-h-16 w-full items-center gap-4 rounded-xl border bg-card p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60',
          t.concluida && 'bg-secondary/60',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg border-2',
            t.concluida ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card',
          )}
        >
          {t.concluida && <Check className="size-6" strokeWidth={3} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('text-lg font-semibold', t.concluida && 'text-muted-foreground line-through')}>
            {t.titulo}
          </span>
          <span className="text-base text-muted-foreground">
            {t.concluida && t.concluidaEm
              ? `Feita às ${horaDe(t.concluidaEm)}`
              : t.hora
                ? `Às ${t.hora}`
                : 'Qualquer hora'}
          </span>
        </span>
      </button>
    </li>
  )
}

function TodasAsTarefas() {
  const consulta = useRotinas()
  const rotinas = consulta.data ?? []
  if (consulta.isPending) return <Skeleton className="h-40 rounded-xl" />
  if (rotinas.length === 0) {
    return (
      <EstadoVazio
        icone={ListChecks}
        titulo="Nenhuma tarefa cadastrada"
        acao={
          <Button asChild>
            <Link to="/rotina/nova">Criar tarefa</Link>
          </Button>
        }
      />
    )
  }
  return (
    <ul className="divide-y rounded-xl border bg-card" aria-label="Todas as tarefas">
      {rotinas.map((r) => (
        <li key={r.id}>
          <Link to={`/rotina/${r.id}`} className="flex flex-col gap-0.5 p-4 hover:bg-muted/60">
            <span className="flex items-center justify-between gap-3">
              <span className={cn('text-lg font-semibold', !r.ativo && 'text-muted-foreground')}>
                {r.titulo}
              </span>
              {!r.ativo && (
                <span className="rounded-md bg-muted px-2 font-semibold text-muted-foreground">Pausada</span>
              )}
            </span>
            <span className="text-base text-muted-foreground">
              {descreverDias(r.diasSemana)}
              {r.hora && `, às ${r.hora}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
