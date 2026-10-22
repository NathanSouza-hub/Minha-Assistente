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
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2
        id={id}
        className={cn(
          'flex items-center gap-1.5 text-[1.18rem] font-bold tracking-[-0.015em]',
          titulo === 'Atrasadas' && 'text-base text-atraso',
        )}
      >
        {titulo === 'Atrasadas' && <WarningCircleIcon weight="bold" className="size-5" aria-hidden />}
        {titulo}
      </h2>
      <Lista>
        {tarefas.map((t) => (
          <Linha key={t.id} tarefa={t} mostrarData={mostrarData} />
        ))}
      </Lista>
    </section>
  )
}

/** Círculo à esquerda (conclui/reabre), como no Início; o resto da linha abre a tarefa. */
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
      para={`/tarefas/${t.id}`}
      apoio={
        (quando || t.detalhes) && (
          <p className={cn(t.atrasada && 'font-semibold text-atraso')}>
            {t.lembrete && !t.concluida && (
              <BellIcon className="mr-1 mb-[0.15em] inline size-4 align-middle" aria-label="Com lembrete" />
            )}
            {[quando, t.detalhes].filter(Boolean).join(' · ')}
          </p>
        )
      }
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

  return (
    <form
      noValidate
      onSubmit={handleSubmit(enviar)}
      className="superficie flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
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
      <h2 id="sugestoes-tarefas" className="text-[1.18rem] font-bold tracking-[-0.015em]">
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
