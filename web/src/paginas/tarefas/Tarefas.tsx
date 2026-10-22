import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BellIcon, CheckIcon, ListChecksIcon, PlusIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useConcluirTarefa, useSalvarTarefa, useTarefas } from '@/consultas/tarefas'
import { dataCurta, deDataHoraISO, diaCurto, hojeISO } from '@/lib/datas'
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
          <Grupo
            titulo="Feitas"
            tarefas={[...lista].sort((a, b) => (b.concluidaEm ?? '').localeCompare(a.concluidaEm ?? ''))}
          />
        ) : (
          <AFazer lista={lista} />
        )}
        {visao === 'afazer' && consulta.isSuccess && <Sugestoes pendentes={lista} />}
      </div>
    </Pagina>
  )
}

/** Atrasadas, de hoje e próximas (cada dia com o nome). */
function AFazer({ lista }: { lista: Tarefa[] }) {
  const hoje = hojeISO()
  const atrasadas = lista.filter((t) => t.data < hoje)
  const deHoje = lista.filter((t) => t.data === hoje)
  const proximas = lista.filter((t) => t.data > hoje)
  return (
    <div className="flex flex-col gap-6">
      {atrasadas.length > 0 && <Grupo titulo="Atrasadas" tarefas={atrasadas} mostrarData />}
      {deHoje.length > 0 && <Grupo titulo="Hoje" tarefas={deHoje} />}
      {proximas.length > 0 && <Grupo titulo="Próximas" tarefas={proximas} mostrarData />}
    </div>
  )
}

function Grupo({ titulo, tarefas, mostrarData }: { titulo: string; tarefas: Tarefa[]; mostrarData?: boolean }) {
  const id = `grupo-${titulo.toLowerCase()}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <h2 id={id} className={cn('text-xl font-bold', titulo === 'Atrasadas' && 'text-atraso')}>
        {titulo}
      </h2>
      <ul className="flex flex-col divide-y divide-linha">
        {tarefas.map((t) => (
          <Linha key={t.id} tarefa={t} mostrarData={mostrarData} />
        ))}
      </ul>
    </section>
  )
}

/** ✓ grande à esquerda (conclui/reabre); o resto da linha abre a tarefa. */
function Linha({ tarefa: t, mostrarData }: { tarefa: Tarefa; mostrarData?: boolean }) {
  const concluir = useConcluirTarefa()
  const quando = [
    t.concluida && t.concluidaEm ? `Feita em ${dataCurta(deDataHoraISO(t.concluidaEm).toISODate()!)}` : null,
    !t.concluida && mostrarData ? diaCurto(t.data) : null,
    t.hora,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li className="flex items-center gap-3 py-2">
      <button
        type="button"
        onClick={() =>
          concluir.mutate(
            { id: t.id, concluida: !t.concluida },
            { onSuccess: () => toast.success(t.concluida ? 'Tarefa reaberta.' : 'Pronto, tarefa feita.') },
          )
        }
        disabled={concluir.isPending}
        aria-pressed={t.concluida}
        aria-label={t.concluida ? `Reabrir ${t.titulo}` : `Marcar ${t.titulo} como feita`}
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-full border-2 transition-colors',
          t.concluida ? 'border-ok bg-ok text-folha' : 'border-ok/60 text-ok hover:bg-ok-fundo',
        )}
      >
        <CheckIcon className="size-6" weight="bold" aria-hidden />
      </button>
      <Link
        to={`/tarefas/${t.id}`}
        className="-mx-2 flex min-w-0 flex-1 flex-col rounded-lg px-2 py-1 hover:bg-suave/60"
      >
        <span className={cn('text-lg leading-snug font-bold', t.concluida && 'text-muted-foreground line-through')}>
          {t.titulo}
        </span>
        {(quando || t.detalhes) && (
          <span
            className={cn('flex items-center gap-1.5 text-base', t.atrasada ? 'text-atraso' : 'text-muted-foreground')}
          >
            {t.lembrete && !t.concluida && <BellIcon className="size-4" aria-label="Com lembrete" />}
            {[quando, t.detalhes].filter(Boolean).join(' · ')}
          </span>
        )}
      </Link>
    </li>
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

  return (
    <form
      noValidate
      onSubmit={handleSubmit(enviar)}
      className="flex flex-col gap-3 rounded-2xl bg-folha p-4 shadow-folha sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <Campo
          rotulo="Nova tarefa para hoje"
          placeholder="Ex.: Ler e-mails"
          erro={errors.titulo?.message}
          {...register('titulo')}
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        <PlusIcon weight="bold" aria-hidden />
        {isSubmitting ? 'Anotando…' : 'Anotar'}
      </Button>
    </form>
  )
}

/** Os lembretes comuns (e-mails, WhatsApp...) que não estão na lista: abrem o formulário preenchido. */
function Sugestoes({ pendentes }: { pendentes: Tarefa[] }) {
  const faltando = sugestoesFaltando(pendentes)
  if (faltando.length === 0) return null
  return (
    <section aria-labelledby="sugestoes-tarefas" className="flex flex-col gap-3">
      <h2 id="sugestoes-tarefas" className="text-lg font-semibold">
        Sugestões para adicionar
      </h2>
      <ul className="flex flex-wrap gap-2">
        {faltando.map((s) => (
          <li key={s}>
            <Button asChild variant="outline" className="border-dashed">
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
