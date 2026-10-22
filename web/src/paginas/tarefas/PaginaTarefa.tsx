import { useEffect, useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftIcon, CheckIcon, TrashIcon } from '@phosphor-icons/react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useConvidarNotificacoes } from '@/consultas/notificacoes'
import { useConcluirTarefa, useExcluirTarefa, useSalvarTarefa, useTarefa } from '@/consultas/tarefas'
import { dataCurta, deDataHoraISO, hojeISO } from '@/lib/datas'
import { aplicarErroApi } from '@/lib/formulario'
import type { Tarefa } from '@/lib/tipos'
import { QuantasVezes } from '@/paginas/rotina/PaginaRotina'

// Mesmas regras de src/modules/tarefas/schema.js.
const esquema = z
  .object({
    titulo: z.string().trim().min(1, 'Informe a tarefa.').max(200, 'Título longo demais.'),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe o dia.'),
    hora: z.string().refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Hora inválida.'),
    lembrete: z.boolean(),
    detalhes: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
  })
  .refine((v) => !v.lembrete || v.hora, { message: 'Para receber lembrete, informe a hora.', path: ['hora'] })
type Dados = z.infer<typeof esquema>

/** /tarefas/nova e /tarefas/:id */
export function PaginaTarefa() {
  const { id } = useParams()
  const consulta = useTarefa(id)
  if (id && consulta.isPending) {
    return (
      <Pagina titulo="Tarefa">
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </Pagina>
    )
  }
  if (id && consulta.isError) {
    return (
      <Pagina titulo="Tarefa não encontrada">
        <p className="mb-4">Esta tarefa não existe mais ou foi excluída.</p>
        <Button asChild variant="outline">
          <Link to="/tarefas">Voltar para tarefas</Link>
        </Button>
      </Pagina>
    )
  }
  return <Formulario key={id ?? 'nova'} tarefa={consulta.data} />
}

function Formulario({ tarefa }: { tarefa?: Tarefa }) {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const editando = Boolean(tarefa)
  const salvar = useSalvarTarefa()
  const excluir = useExcluirTarefa()
  const concluir = useConcluirTarefa()
  const convidar = useConvidarNotificacoes()
  const idDetalhes = useId()
  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: {
      titulo: tarefa?.titulo ?? params.get('titulo') ?? '',
      data: tarefa?.data ?? params.get('data') ?? hojeISO(),
      hora: tarefa?.hora ?? '',
      lembrete: tarefa?.lembrete ?? false,
      detalhes: tarefa?.detalhes ?? '',
    },
  })
  const hora = useWatch({ control, name: 'hora' })

  useEffect(() => {
    if (!editando) setFocus('titulo')
  }, [editando, setFocus])

  async function enviar(d: Dados) {
    try {
      const dados = {
        titulo: d.titulo.trim(),
        data: d.data,
        hora: d.hora || null,
        lembrete: Boolean(d.hora) && d.lembrete,
        detalhes: d.detalhes.trim() || null,
      }
      await salvar.mutateAsync({ id: tarefa?.id, dados })
      toast.success(editando ? 'Tarefa salva.' : 'Tarefa criada.')
      navegar('/tarefas')
      if (dados.lembrete) void convidar()
    } catch (erro) {
      aplicarErroApi(erro, setError)
    }
  }

  function remover() {
    if (!tarefa) return
    // Navega antes de a exclusão terminar: a tela lê a tarefa do cache, que sai junto.
    navegar('/tarefas', { replace: true })
    excluir.mutate(tarefa.id, { onSuccess: () => toast.success('Tarefa excluída.') })
  }

  const titulo = editando ? 'Editar tarefa' : 'Nova tarefa'
  return (
    <Pagina
      titulo={titulo}
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to="/tarefas"
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeftIcon className="size-5" weight="bold" aria-hidden />
            Tarefas
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        {tarefa && (
          <section
            aria-label="Situação"
            className="superficie flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-lg font-semibold">
              {tarefa.concluida && tarefa.concluidaEm
                ? `Feita em ${dataCurta(deDataHoraISO(tarefa.concluidaEm).toISODate()!)}`
                : tarefa.atrasada
                  ? 'Atrasada'
                  : 'A fazer'}
            </p>
            <Button
              variant={tarefa.concluida ? 'outline' : 'confirmar'}
              disabled={concluir.isPending}
              onClick={() => concluir.mutate({ id: tarefa.id, concluida: !tarefa.concluida })}
            >
              <CheckIcon aria-hidden />
              {tarefa.concluida ? 'Reabrir tarefa' : 'Marcar como feita'}
            </Button>
          </section>
        )}

        <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6">
          {!editando && (
            <QuantasVezes
              valor="uma"
              aoTrocar={() => navegar(`/rotina/nova?titulo=${encodeURIComponent(getValues('titulo'))}`)}
            />
          )}
          <Campo
            rotulo="Tarefa"
            placeholder="Ex.: Ligar para o contador"
            erro={errors.titulo?.message}
            {...register('titulo')}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <Campo rotulo="Dia" type="date" erro={errors.data?.message} {...register('data')} />
            <Campo
              rotulo="Hora (opcional)"
              type="time"
              dica={'Sem hora, fica no "Dia todo" da tela Hoje.'}
              erro={errors.hora?.message}
              {...register('hora')}
            />
          </div>
          <Controller
            control={control}
            name="lembrete"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4 rounded-xl bg-suave/70 p-4">
                <Label htmlFor="lembrete-tarefa" className="flex flex-col items-start leading-snug">
                  Avisar no celular na hora
                  {!hora && (
                    <span className="text-base font-normal text-muted-foreground">Escolha a hora para ligar.</span>
                  )}
                </Label>
                <Switch
                  id="lembrete-tarefa"
                  checked={Boolean(hora) && field.value}
                  disabled={!hora}
                  onCheckedChange={field.onChange}
                />
              </div>
            )}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor={idDetalhes}>Detalhes (opcional)</Label>
            <Textarea id={idDetalhes} placeholder="Ex.: telefone, o que falar" {...register('detalhes')} />
          </div>

          {errors.root && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
              {errors.root.message}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar tarefa'}
            </Button>
            {tarefa && (
              <Confirmar
                gatilho={
                  <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                    <TrashIcon aria-hidden />
                    Excluir tarefa
                  </Button>
                }
                titulo={`Excluir "${tarefa.titulo}"?`}
                descricao="Não dá para desfazer."
                confirmar="Excluir tarefa"
                aoConfirmar={remover}
              />
            )}
          </div>
        </form>
      </div>
    </Pagina>
  )
}
