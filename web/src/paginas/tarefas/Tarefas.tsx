import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BellIcon, ListChecksIcon, PlusIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Lista, LinhaMarcavel } from '@/components/Linha'
import { Opcoes } from '@/components/Opcoes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useConcluirTarefa, useSalvarTarefa, useTarefas } from '@/consultas/tarefas'
import { dataCurta, deDataHoraISO, diaCurto, hojeISO, rotuloDoDia } from '@/lib/datas'
import { aplicarErroApi } from '@/lib/formulario'
import type { Tarefa } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { sugestoesFaltando } from '@/paginas/rotina/sugestoes'

type Visao = 'afazer' | 'feitas'

/** /tarefas: o que fazer (atrasadas, hoje e próximas) e o que já foi feito, com ✓ em cada linha. */
export function Tarefas() {
  const [params, setParams] = useSearchParams()
  const visao: Visao = params.get('visao') === 'feitas' ? 'feitas' : 'afazer'
  const consulta = useTarefas({ situacao: visao === 'feitas' ? 'concluida' : 'pendente' })
  const lista = consulta.data ?? []

  return (
    <Pagina
      titulo="Lembretes de uma vez"
      acoes={
        <Button asChild variant="secondary">
          <Link to="/tarefas/nova">
            <PlusIcon weight="bold" aria-hidden />
            Nova
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <AdicionarRapido />
        <Opcoes<Visao>
          rotulo="Mostrar"
          rotuloOculto
          formato="segmentos"
          valor={visao}
          aoMudar={(v) => setParams(v === 'afazer' ? {} : { visao: v }, { replace: true })}
          opcoes={[
            { valor: 'afazer', rotulo: 'A fazer' },
            { valor: 'feitas', rotulo: 'Feitas' },
          ]}
        />
        {consulta.isPending ? (
          <div role="status" aria-label="Carregando tarefas" className="flex flex-col gap-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : consulta.isError ? (
          <EstadoVazio
            icone={ListChecksIcon}
            titulo="Não foi possível carregar as tarefas"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          />
        ) : lista.length === 0 ? (
          <EstadoVazio
            icone={ListChecksIcon}
            titulo={visao === 'feitas' ? 'Nenhuma tarefa feita ainda.' : 'Nada a fazer. Aproveite!'}
          >
            {visao === 'afazer' && 'Escreva acima o que precisa fazer, como "Ler e-mails" ou "Ligar para o contador".'}
          </EstadoVazio>
        ) : visao === 'feitas' ? (
          <Grupo titulo="Feitas" total={lista.length}>
            <Lista>
              {[...lista]
                .sort((a, b) => (b.concluidaEm ?? '').localeCompare(a.concluidaEm ?? ''))
                .map((t) => (
                  <Linha key={t.id} tarefa={t} />
                ))}
            </Lista>
          </Grupo>
        ) : (
          <AFazer lista={lista} />
        )}
        {visao === 'afazer' && consulta.isSuccess && <Sugestoes pendentes={lista} />}
      </div>
    </Pagina>
  )
}

/**
 * Atrasadas num bloco próprio (com "era para" e o dia), as de hoje com a hora à direita e as
 * próximas separadas por dia. A API não tem prioridade: a ordem pelo prazo faz esse papel.
 */
function AFazer({ lista }: { lista: Tarefa[] }) {
  const hoje = hojeISO()
  const atrasadas = lista.filter((t) => t.data < hoje)
  const deHoje = lista.filter((t) => t.data === hoje)
  const proximas = lista.filter((t) => t.data > hoje)
  const dias = [...new Set(proximas.map((t) => t.data))]
  return (
    <div className="flex flex-col gap-6">
      {atrasadas.length > 0 && (
        <Grupo titulo="Atrasadas" total={atrasadas.length} atraso>
          <ul className="flex flex-col divide-y divide-atraso/15">
            {atrasadas.map((t) => (
              <Linha key={t.id} tarefa={t} quando={`Era para ${diaCurto(t.data).toLowerCase()}`} />
            ))}
          </ul>
        </Grupo>
      )}
      {deHoje.length > 0 && (
        <Grupo titulo="Hoje" total={deHoje.length}>
          <Lista>
            {deHoje.map((t) => (
              <Linha key={t.id} tarefa={t} />
            ))}
          </Lista>
        </Grupo>
      )}
      {proximas.length > 0 && (
        <Grupo titulo="Próximas" total={proximas.length}>
          <div className="superficie flex flex-col overflow-hidden">
            {dias.map((dia) => (
              <div key={dia} className="border-t border-linha first:border-t-0">
                <h3 className="px-4 pt-3 text-apoio font-bold text-muted-foreground">{rotuloDoDia(dia, hoje)}</h3>
                <ul className="flex flex-col divide-y divide-linha">
                  {proximas
                    .filter((t) => t.data === dia)
                    .map((t) => (
                      <Linha key={t.id} tarefa={t} />
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </Grupo>
      )}
    </div>
  )
}

function Grupo({
  titulo,
  total,
  atraso,
  children,
}: {
  titulo: string
  total: number
  atraso?: boolean
  children: ReactNode
}) {
  const id = `grupo-${titulo.toLowerCase()}`
  const cabecalho = (
    <h2 className={cn('flex items-baseline gap-2 text-secao font-bold', atraso && 'text-atraso')}>
      {atraso && <WarningCircleIcon weight="bold" className="size-5 self-center" aria-hidden />}
      <span id={id}>{titulo}</span>
      <span className="text-apoio font-semibold text-muted-foreground tabular-nums">{total}</span>
    </h2>
  )
  // Atrasadas: um bloco tingido só, sem cartão dentro de cartão.
  return atraso ? (
    <section aria-labelledby={id} className="flex flex-col gap-1 rounded-[1.4rem] bg-atraso-fundo px-2 pt-3.5 pb-1.5">
      <div className="px-2">{cabecalho}</div>
      {children}
    </section>
  ) : (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      {cabecalho}
      {children}
    </section>
  )
}

/**
 * Círculo à esquerda (conclui/reabre), como no Início; o resto da linha abre a tarefa. A hora fica
 * à direita, na linha do título; `quando` é o prazo em texto (atrasadas).
 */
function Linha({ tarefa: t, quando }: { tarefa: Tarefa; quando?: string }) {
  const concluir = useConcluirTarefa()
  const detalhe = [
    t.concluida && t.concluidaEm ? `Feita em ${dataCurta(deDataHoraISO(t.concluidaEm).toISODate()!)}` : null,
    !t.concluida ? quando : null,
    t.detalhes,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <LinhaMarcavel
      estado={t.concluida ? 'feito' : 'pendente'}
      marcar={{
        rotulo: t.concluida ? `Reabrir ${t.titulo}` : `Marcar ${t.titulo} como feita`,
        marcado: t.concluida,
        desabilitado: concluir.isPending,
        aoMarcar: () =>
          concluir.mutate(
            { id: t.id, concluida: !t.concluida },
            { onSuccess: () => toast.success(t.concluida ? 'Tarefa reaberta.' : 'Pronto, tarefa feita.') },
          ),
      }}
      titulo={t.titulo}
      valor={
        !t.concluida &&
        (t.hora || t.lembrete) && (
          <span className={cn('flex items-center gap-1 pr-2 text-apoio', t.atrasada ? 'text-atraso' : 'text-muted-foreground')}>
            {t.lembrete && <BellIcon weight="bold" className="size-4" aria-label="Com lembrete" />}
            {t.hora}
          </span>
        )
      }
      para={`/tarefas/${t.id}`}
      apoio={detalhe && <p className={cn(t.atrasada && !t.concluida && 'font-semibold text-atraso')}>{detalhe}</p>}
    />
  )
}

const esquemaRapido = z.object({
  titulo: z.string().trim().min(1, 'Escreva a tarefa.').max(200, 'Título longo demais.'),
})

/** Uma linha para anotar algo a fazer hoje; hora, lembrete e detalhes ficam no formulário completo. */
function AdicionarRapido() {
  const salvar = useSalvarTarefa()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ titulo: string }>({ resolver: zodResolver(esquemaRapido), defaultValues: { titulo: '' } })

  async function enviar({ titulo }: { titulo: string }) {
    try {
      await salvar.mutateAsync({
        dados: { titulo: titulo.trim(), detalhes: null, data: hojeISO(), hora: null, lembrete: false },
      })
      toast.success('Tarefa anotada para hoje.')
      reset({ titulo: '' })
    } catch (erro) {
      aplicarErroApi(erro, setError)
    }
  }

  // Uma linha só: o campo em pílula e o "+" redondo (com o texto no computador).
  return (
    <form
      noValidate
      onSubmit={handleSubmit(enviar)}
      className="area-tarefas grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-[1.75rem] bg-folha p-3 shadow-[var(--shadow-folha)] sm:p-4"
    >
      <Campo
        rotulo="Nova tarefa para hoje"
        rotuloOculto
        placeholder="Anotar uma tarefa para hoje"
        autoComplete="off"
        enterKeyHint="done"
        className="h-12 rounded-full border-0 bg-suave px-5 text-[1.05rem]"
        erro={errors.titulo?.message}
        {...register('titulo')}
      />
      <Button
        type="submit"
        disabled={isSubmitting}
        aria-label="Anotar"
        className="size-12 bg-area px-0 text-white hover:bg-area/90 sm:w-auto sm:px-5"
      >
        <PlusIcon weight="bold" className="size-6 sm:size-5" aria-hidden />
        <span className="hidden sm:inline">{isSubmitting ? 'Anotando…' : 'Anotar'}</span>
      </Button>
      {errors.root && (
        <p role="alert" className="col-span-full font-semibold text-destructive">
          {errors.root.message}
        </p>
      )}
    </form>
  )
}

/** Os lembretes comuns (e-mails, WhatsApp...) que não estão na lista: abrem o formulário preenchido. */
function Sugestoes({ pendentes }: { pendentes: Tarefa[] }) {
  const faltando = sugestoesFaltando(pendentes)
  if (faltando.length === 0) return null
  return (
    <section aria-labelledby="sugestoes-tarefas" className="flex flex-col gap-3">
      <h2 id="sugestoes-tarefas" className="text-apoio font-bold text-muted-foreground">
        Sugestões para adicionar
      </h2>
      <ul className="flex flex-wrap gap-2">
        {faltando.map((s) => (
          <li key={s}>
            <Button asChild variant="ghost" size="sm" className="rounded-full border border-dashed border-contorno">
              <Link to={`/tarefas/nova?titulo=${encodeURIComponent(s)}`}>
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
