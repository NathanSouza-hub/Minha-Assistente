import { useEffect, useId } from 'react'
import { Controller, useFieldArray, useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useExcluirMedicamento, useMedicamento, useSalvarMedicamento } from '@/consultas/medicamentos'
import { aplicarErroApi } from '@/lib/formulario'
import type { Medicamento, PeriodoRemedio } from '@/lib/tipos'
import {
  esquemaRemedio,
  HORA_SUGERIDA,
  MAXIMO_HORARIOS,
  novoHorario,
  paraCorpo,
  valoresIniciais,
  type DadosRemedio,
} from './formulario'
import { DIAS_SEMANA, PERIODOS } from './textos'

/** /remedios/novo e /remedios/:id */
export function PaginaRemedio() {
  const { id } = useParams()
  const consulta = useMedicamento(id)

  if (id && consulta.isPending) {
    return (
      <Pagina titulo="Editar remédio">
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20" />
          ))}
        </div>
      </Pagina>
    )
  }
  if (id && consulta.isError) {
    return (
      <Pagina titulo="Remédio não encontrado">
        <p className="mb-4 text-lg">Este remédio não existe mais ou foi excluído.</p>
        <Button asChild variant="outline">
          <Link to="/remedios?visao=lista">Voltar para meus remédios</Link>
        </Button>
      </Pagina>
    )
  }
  return <FormularioRemedio key={id ?? 'novo'} remedio={consulta.data} />
}

function FormularioRemedio({ remedio }: { remedio?: Medicamento }) {
  const navegar = useNavigate()
  const editando = Boolean(remedio)
  const salvar = useSalvarMedicamento()
  const excluir = useExcluirMedicamento()
  const formulario = useForm<DadosRemedio>({
    resolver: zodResolver(esquemaRemedio),
    defaultValues: valoresIniciais(remedio),
  })
  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = formulario
  const horarios = useFieldArray({ control, name: 'horarios', keyName: 'chave' })

  useEffect(() => {
    if (!editando) setFocus('nome')
  }, [editando, setFocus])

  async function enviar(dados: DadosRemedio) {
    try {
      await salvar.mutateAsync({ id: remedio?.id, dados: paraCorpo(dados) })
      toast.success(editando ? 'Remédio salvo.' : `${dados.nome.trim()} cadastrado.`)
      navegar(editando ? '/remedios?visao=lista' : '/remedios')
    } catch (erro) {
      aplicarErroApi(erro, setError)
    }
  }

  function remover() {
    if (!remedio) return
    excluir.mutate(remedio.id, {
      onSuccess: () => {
        toast.success(`${remedio.nome} excluído.`)
        navegar('/remedios?visao=lista')
      },
    })
  }

  const idObs = useId()
  const titulo = editando ? 'Editar remédio' : 'Novo remédio'

  return (
    <Pagina
      titulo={titulo}
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to={editando ? '/remedios?visao=lista' : '/remedios'}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Remédios
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Campo
            rotulo="Nome do remédio"
            placeholder="Ex.: Losartana"
            erro={errors.nome?.message}
            {...register('nome')}
          />
          <Campo
            rotulo="Dose (opcional)"
            placeholder="Ex.: 1 comprimido de 50 mg"
            erro={errors.dose?.message}
            {...register('dose')}
          />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-base font-semibold">Quando tomar</legend>
          <ul className="flex flex-col gap-3">
            {horarios.fields.map((campo, indice) => (
              <LinhaHorario
                key={campo.chave}
                indice={indice}
                formulario={formulario}
                podeRemover={horarios.fields.length > 1}
                aoRemover={() => horarios.remove(indice)}
              />
            ))}
          </ul>
          {errors.horarios?.root?.message || errors.horarios?.message ? (
            <p className="text-base font-semibold text-destructive">
              {errors.horarios?.root?.message ?? errors.horarios?.message}
            </p>
          ) : null}
          {horarios.fields.length < MAXIMO_HORARIOS && (
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => horarios.append(novoHorario(horarios.fields.length === 1 ? 'noite' : 'tarde'))}
            >
              <Plus aria-hidden />
              Adicionar horário
            </Button>
          )}
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor={idObs}>Observações (opcional)</Label>
          <Textarea id={idObs} placeholder="Ex.: tomar em jejum" {...register('observacoes')} />
        </div>

        {editando && (
          <Controller
            control={control}
            name="ativo"
            render={({ field }) => (
              <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="em-uso" className="text-lg">
                    Em uso
                  </Label>
                  <Switch id="em-uso" checked={field.value} onCheckedChange={field.onChange} />
                </div>
                <p className="text-base text-muted-foreground">
                  {field.value
                    ? 'Aparece nas doses do dia.'
                    : 'Pausado: some das doses do dia, mas o cadastro e o histórico ficam.'}
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
            {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar remédio'}
          </Button>
          {remedio && (
            <Confirmar
              gatilho={
                <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                  <Trash2 aria-hidden />
                  Excluir remédio
                </Button>
              }
              titulo={`Excluir ${remedio.nome}?`}
              descricao="O histórico de doses tomadas também será apagado. Para só parar de tomar por um tempo, desligue “Em uso”."
              confirmar="Excluir remédio"
              aoConfirmar={remover}
            />
          )}
        </div>
      </form>
    </Pagina>
  )
}

function LinhaHorario({
  indice,
  formulario,
  podeRemover,
  aoRemover,
}: {
  indice: number
  formulario: UseFormReturn<DadosRemedio>
  podeRemover: boolean
  aoRemover: () => void
}) {
  const { register, watch, setValue, getValues, formState } = formulario
  const periodo = watch(`horarios.${indice}.periodo`)
  const erros = formState.errors.horarios?.[indice]
  const numero = indice + 1

  // Trocar o período sugere a hora daquele período, se a pessoa não tinha mudado a sugestão.
  const campoPeriodo = register(`horarios.${indice}.periodo`, {
    onChange: (e) => {
      const novo = e.target.value as PeriodoRemedio
      const hora = getValues(`horarios.${indice}.hora`)
      if (!hora || Object.values(HORA_SUGERIDA).includes(hora))
        setValue(`horarios.${indice}.hora`, HORA_SUGERIDA[novo])
      if (novo !== 'semanal') setValue(`horarios.${indice}.diaSemana`, '')
    },
  })

  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-muted-foreground">Horário {numero}</span>
        {podeRemover && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={aoRemover}
            aria-label={`Remover horário ${numero}`}
          >
            <X aria-hidden />
            Remover
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Selecao rotulo="Período" {...campoPeriodo}>
          {Object.entries(PERIODOS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        {periodo === 'semanal' && (
          <Selecao
            rotulo="Dia da semana"
            erro={erros?.diaSemana?.message}
            {...register(`horarios.${indice}.diaSemana`)}
          >
            <option value="" disabled>
              Escolha o dia
            </option>
            {DIAS_SEMANA.map((dia, i) => (
              <option key={dia} value={i}>
                {dia}
              </option>
            ))}
          </Selecao>
        )}
        <Campo
          rotulo="Hora (opcional)"
          type="time"
          erro={erros?.hora?.message}
          {...register(`horarios.${indice}.hora`)}
        />
      </div>
    </li>
  )
}
