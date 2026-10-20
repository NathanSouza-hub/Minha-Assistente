import { CheckSquareIcon, PlusIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { NavegadorDia } from '@/components/NavegadorDia'
import { Opcoes } from '@/components/Opcoes'
import { Progresso } from '@/components/Progresso'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRotinas, useTarefasDoDia } from '@/consultas/rotinas'
import { hojeISO } from '@/lib/datas'
import { cn } from '@/lib/utils'
import { descreverDias } from './dias'
import { ItemTarefa } from './ItemTarefa'
import { sugestoesFaltando } from './sugestoes'

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
      titulo="Compromissos"
      acoes={
        <Button asChild size="lg">
          <Link to="/rotina/nova">
            <PlusIcon weight="bold" aria-hidden />
            Novo
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
            { valor: 'dia', rotulo: 'Do dia' },
            { valor: 'todas', rotulo: 'Todos' },
          ]}
        />
        {visao === 'dia' ? (
          <TarefasDoDia data={data} mudarData={(d) => mudar('data', d, hojeISO())} />
        ) : (
          <TodasAsTarefas />
        )}
        <Sugestoes />
      </div>
    </Pagina>
  )
}

/** Atalhos para cadastrar os compromissos comuns que ainda faltam (abrem o formulário preenchido). */
function Sugestoes() {
  const { data: rotinas } = useRotinas()
  if (!rotinas) return null
  const faltando = sugestoesFaltando(rotinas)
  if (faltando.length === 0) return null
  return (
    <section aria-labelledby="sugestoes" className="flex flex-col gap-3">
      <h2 id="sugestoes" className="text-lg font-semibold">
        Sugestões para adicionar
      </h2>
      <ul className="flex flex-wrap gap-2">
        {faltando.map((s) => (
          <li key={s}>
            <Button asChild variant="outline" className="border-dashed">
              <Link to={`/rotina/nova?titulo=${encodeURIComponent(s)}`}>
                <PlusIcon weight="bold" aria-hidden />
                {s}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
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
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando compromissos">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-16" />
          ))}
        </div>
      ) : consulta.isError ? (
        <EstadoVazio
          icone={CheckSquareIcon}
          titulo="Não foi possível carregar os compromissos"
          acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
        >
          Verifique a internet e tente de novo.
        </EstadoVazio>
      ) : tarefas.length === 0 ? (
        <EstadoVazio
          icone={CheckSquareIcon}
          titulo="Nenhum compromisso para este dia"
          acao={
            <Button asChild>
              <Link to="/rotina/nova">Criar compromisso</Link>
            </Button>
          }
        >
          Compromissos são as tarefas que se repetem, como ler e-mails ou responder mensagens.
        </EstadoVazio>
      ) : (
        <>
          <Progresso
            feitos={feitas}
            total={tarefas.length}
            texto={`${feitas} de ${tarefas.length} ${tarefas.length === 1 ? 'compromisso feito' : 'compromissos feitos'}`}
            textoCompleto="Todos os compromissos do dia feitos."
          />
          {futuro && <p className="text-base text-muted-foreground">Dá para marcar quando o dia chegar.</p>}
          <ul className="flex flex-col divide-y divide-linha" aria-label="Compromissos do dia">
            {tarefas.map((t) => (
              <ItemTarefa key={t.rotinaId} tarefa={t} desabilitada={futuro} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function TodasAsTarefas() {
  const consulta = useRotinas()
  const rotinas = consulta.data ?? []
  if (consulta.isPending) return <Skeleton className="h-40 rounded-xl" />
  if (rotinas.length === 0) {
    return (
      <EstadoVazio
        icone={CheckSquareIcon}
        titulo="Nenhum compromisso cadastrado"
        acao={
          <Button asChild>
            <Link to="/rotina/nova">Criar compromisso</Link>
          </Button>
        }
      />
    )
  }
  return (
    <ul className="flex flex-col divide-y divide-linha" aria-label="Todos os compromissos">
      {rotinas.map((r) => (
        <li key={r.id}>
          <Link to={`/rotina/${r.id}`} className="-mx-2 my-1 flex flex-col gap-0.5 rounded-lg px-2 py-3 hover:bg-suave/70">
            <span className="flex items-center justify-between gap-3">
              <span className={cn('text-lg font-semibold', !r.ativo && 'text-muted-foreground')}>
                {r.titulo}
              </span>
              {!r.ativo && (
                <span className="rounded-full bg-suave px-2.5 font-semibold text-muted-foreground">Pausado</span>
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
