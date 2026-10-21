import { useEffect, useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftIcon, CheckCircleIcon, CheckIcon, TrashIcon, XCircleIcon } from '@phosphor-icons/react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Opcoes } from '@/components/Opcoes'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useExcluirRotina, useHistoricoRotina, useRotinas, useSalvarRotina } from '@/consultas/rotinas'
import { useConvidarNotificacoes } from '@/consultas/notificacoes'
import { dataCurta, deDataHoraISO } from '@/lib/datas'
import { aplicarErroApi } from '@/lib/formulario'
import type { Rotina, RotinaCorpo } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { DIAS, FIM_DE_SEMANA, ORDEM_EXIBICAO, TODOS, UTEIS } from './dias'

const esquema = z
  .object({
    titulo: z.string().trim().min(1, 'Informe o compromisso.').max(200, 'Texto longo demais.'),
    hora: z.string().refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Hora inválida.'),
    diasSemana: z.array(z.number()).min(1, 'Escolha pelo menos um dia.'),
    lembrete: z.boolean(),
    ativo: z.boolean(),
    observacoes: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.lembrete && !v.hora) {
      ctx.addIssue({ code: 'custom', path: ['hora'], message: 'Para receber lembrete, informe a hora.' })
    }
  })
type Dados = z.infer<typeof esquema>

const iniciais = (r?: Rotina, tituloSugerido = ''): Dados =>
  r
    ? {
        titulo: r.titulo,
        hora: r.hora ?? '',
        diasSemana: r.diasSemana,
        lembrete: r.lembrete,
        ativo: r.ativo,
        observacoes: r.observacoes ?? '',
      }
    : { titulo: tituloSugerido, hora: '', diasSemana: TODOS, lembrete: false, ativo: true, observacoes: '' }

const paraCorpo = (d: Dados): RotinaCorpo => ({
  titulo: d.titulo.trim(),
  hora: d.hora || null,
  diasSemana: [...d.diasSemana].sort(),
  lembrete: Boolean(d.hora) && d.lembrete,
  ativo: d.ativo,
  observacoes: d.observacoes.trim() || null,
})

/** /rotina/nova e /rotina/:id (a lista já traz tudo; o back-end não tem GET /rotinas/:id). */
export function PaginaRotina() {
  const { id } = useParams()
  const consulta = useRotinas()
  const rotina = consulta.data?.find((r) => r.id === id)

  if (id && consulta.isPending) {
    return (
      <Pagina titulo="Editar compromisso">
        <Skeleton className="h-60 rounded-xl" />
      </Pagina>
    )
  }
  if (id && !rotina) {
    return (
      <Pagina titulo="Compromisso não encontrado">
        <p className="mb-4 text-lg">Este compromisso não existe mais ou foi excluído.</p>
        <Button asChild variant="outline">
          <Link to="/rotina?visao=todas">Voltar para os compromissos</Link>
        </Button>
      </Pagina>
    )
  }
  return <FormularioRotina key={id ?? 'nova'} rotina={rotina} />
}

function FormularioRotina({ rotina }: { rotina?: Rotina }) {
  const navegar = useNavigate()
  const editando = Boolean(rotina)
  const salvar = useSalvarRotina()
  const convidar = useConvidarNotificacoes()
  const excluir = useExcluirRotina()
  // Vindo de uma sugestão (/rotina/nova?titulo=...), o nome já vem preenchido.
  const [params] = useSearchParams()
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
    defaultValues: iniciais(rotina, params.get('titulo') ?? ''),
  })
  const idObs = useId()
  const hora = useWatch({ control, name: 'hora' })

  useEffect(() => {
    if (!editando) setFocus('titulo')
  }, [editando, setFocus])

  async function enviar(dados: Dados) {
    try {
      const corpo = paraCorpo(dados)
      await salvar.mutateAsync({ id: rotina?.id, dados: corpo })
      toast.success(editando ? 'Compromisso salvo.' : 'Compromisso criado.')
      navegar(editando ? '/rotina?visao=todas' : '/rotina')
      if (corpo.lembrete) void convidar()
    } catch (erro) {
      aplicarErroApi(erro, setError)
    }
  }

  const titulo = editando ? 'Editar compromisso' : 'Novo compromisso'
  const voltar = editando ? '/rotina?visao=todas' : '/rotina'

  return (
    <Pagina
      titulo={titulo}
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to={voltar}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeftIcon className="size-5" weight="bold" aria-hidden />
            Compromissos
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6">
        {!editando && (
          <QuantasVezes
            valor="repete"
            aoTrocar={() => navegar(`/tarefas/nova?titulo=${encodeURIComponent(getValues('titulo'))}`)}
          />
        )}
        <Campo
          rotulo="Compromisso"
          placeholder="Ex.: Leitura de e-mails"
          erro={errors.titulo?.message}
          {...register('titulo')}
        />

        <Controller
          control={control}
          name="diasSemana"
          render={({ field }) => (
            <EscolhaDias valor={field.value} aoMudar={field.onChange} erro={errors.diasSemana?.message} />
          )}
        />

        <Campo
          rotulo="Hora (opcional)"
          type="time"
          dica="Em branco, vale para qualquer hora do dia."
          erro={errors.hora?.message}
          {...register('hora')}
          className="sm:max-w-56"
        />

        <Controller
          control={control}
          name="lembrete"
          render={({ field }) => (
            <div className="flex flex-col gap-1 rounded-2xl bg-folha p-4 shadow-folha">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="lembrete" className="text-lg">
                  Lembrar na hora
                </Label>
                <Switch id="lembrete" checked={field.value} onCheckedChange={field.onChange} />
              </div>
              <p className="text-base text-muted-foreground">
                {hora ? `Avisa às ${hora} nos dias escolhidos.` : 'Precisa de uma hora para avisar.'}
              </p>
            </div>
          )}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor={idObs}>Observações (opcional)</Label>
          <Textarea
            id={idObs}
            placeholder="Ex.: olhar primeiro a caixa do trabalho"
            {...register('observacoes')}
          />
        </div>

        {editando && (
          <Controller
            control={control}
            name="ativo"
            render={({ field }) => (
              <div className="flex flex-col gap-1 rounded-2xl bg-folha p-4 shadow-folha">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="ativa" className="text-lg">
                    Ativo
                  </Label>
                  <Switch id="ativa" checked={field.value} onCheckedChange={field.onChange} />
                </div>
                <p className="text-base text-muted-foreground">
                  {field.value
                    ? 'Aparece nos compromissos do dia.'
                    : 'Pausado: some dos compromissos do dia, mas fica guardado.'}
                </p>
              </div>
            )}
          />
        )}

        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar compromisso'}
          </Button>
          {rotina && (
            <Confirmar
              gatilho={
                <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                  <TrashIcon aria-hidden />
                  Excluir compromisso
                </Button>
              }
              titulo={`Excluir "${rotina.titulo}"?`}
              descricao="O histórico dos dias em que ele foi feito também será apagado. Para parar por um tempo, desligue “Ativo”."
              confirmar="Excluir compromisso"
              aoConfirmar={() => {
                // Esta tela lê a tarefa da lista: quando ela sai do cache, a tela vira "não
                // encontrada" e desmonta. Por isso volta para a lista antes, e o aviso fica preso
                // à promessa (que resolve mesmo com a tela já desmontada).
                const exclusao = excluir.mutateAsync(rotina.id)
                navegar('/rotina?visao=todas')
                exclusao.then(() => toast.success('Compromisso excluído.')).catch(() => {})
              }}
            />
          )}
        </div>
      </form>
      {rotina && <Historico id={rotina.id} />}
    </Pagina>
  )
}

/**
 * "Só uma vez" (lembrete do dia, /tarefas/nova) ou "Repete" (/rotina/nova): os dois cadastros são
 * o mesmo "Novo lembrete" para quem usa; trocar leva o texto já digitado.
 */
export function QuantasVezes({ valor, aoTrocar }: { valor: 'uma' | 'repete'; aoTrocar: () => void }) {
  return (
    <Opcoes<'uma' | 'repete'>
      rotulo="Quantas vezes?"
      formato="segmentos"
      valor={valor}
      aoMudar={(v) => v !== valor && aoTrocar()}
      opcoes={[
        { valor: 'uma', rotulo: 'Só uma vez' },
        { valor: 'repete', rotulo: 'Repete' },
      ]}
    />
  )
}

/** Dias em que o compromisso foi marcado nos últimos 60 dias. */
function Historico({ id }: { id: string }) {
  const consulta = useHistoricoRotina(id)
  const itens = consulta.data ?? []
  return (
    <section aria-labelledby="historico" className="mt-10 flex flex-col gap-3">
      <h2 id="historico" className="text-xl font-bold">
        Histórico
      </h2>
      {consulta.isPending ? (
        <Skeleton className="h-16" />
      ) : itens.length === 0 ? (
        <p className="text-base text-muted-foreground">Nenhum dia marcado nos últimos 60 dias.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-linha">
          {itens.map((h) => (
            <li key={h.data} className="flex items-center gap-2 py-2.5 text-base">
              {h.situacao === 'feito' ? (
                <CheckCircleIcon className="size-6 shrink-0 text-ok" weight="fill" aria-hidden />
              ) : (
                <XCircleIcon className="size-6 shrink-0 text-atraso" weight="fill" aria-hidden />
              )}
              <span className="font-semibold tabular-nums">{dataCurta(h.data)}</span>
              <span className="text-muted-foreground">
                {h.situacao === 'feito' ? `Feito às ${deDataHoraISO(h.em).toFormat('HH:mm')}` : 'Não feito'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Atalhos (todos os dias, segunda a sexta, fim de semana) + um botão por dia. */
function EscolhaDias({
  valor,
  aoMudar,
  erro,
}: {
  valor: number[]
  aoMudar: (v: number[]) => void
  erro?: string
}) {
  const id = useId()
  const atalhos = [
    { rotulo: 'Todos os dias', dias: TODOS },
    { rotulo: 'Segunda a sexta', dias: UTEIS },
    { rotulo: 'Fim de semana', dias: FIM_DE_SEMANA },
  ]
  const igual = (dias: number[]) => dias.length === valor.length && dias.every((d) => valor.includes(d))
  const alternar = (d: number) => aoMudar(valor.includes(d) ? valor.filter((x) => x !== d) : [...valor, d])
  const base =
    'flex min-h-11 items-center gap-2 border px-4 text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={erro ? `${id}-erro` : undefined}>
      <legend className="mb-1 text-base font-semibold">Em quais dias?</legend>
      {/* Dias: ligam e desligam um a um (preenchidos quando escolhidos). */}
      <div className="flex flex-wrap gap-2">
        {ORDEM_EXIBICAO.map((d) => {
          const ligado = valor.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={ligado}
              onClick={() => alternar(d)}
              className={cn(
                base,
                'rounded-full',
                ligado ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card',
              )}
            >
              {ligado && <CheckIcon className="size-5" weight="bold" aria-hidden />}
              {DIAS[d]}
            </button>
          )
        })}
      </div>
      {/* Atalhos: escolhem vários dias de uma vez (estilo mais leve, para não parecer mais um dia). */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        <span className="w-full text-base text-muted-foreground sm:w-auto sm:pr-2">Atalhos:</span>
        {atalhos.map((a) => (
          <button
            key={a.rotulo}
            type="button"
            aria-pressed={igual(a.dias)}
            onClick={() => aoMudar(a.dias)}
            className={cn(
              base,
              'rounded-lg border-transparent px-3 text-primary underline underline-offset-4',
              igual(a.dias) && 'border-primary bg-secondary no-underline',
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {erro && (
        <p id={`${id}-erro`} className="text-base font-semibold text-destructive">
          {erro}
        </p>
      )}
    </fieldset>
  )
}
