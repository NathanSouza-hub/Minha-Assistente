import { useEffect } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeftIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Opcoes } from '@/components/Opcoes'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useEquipe, useExcluirMembro, useSalvarMembro } from '@/consultas/equipe'
import { aplicarErroApi } from '@/lib/formulario'
import type { FormaPagamento, MembroEquipe } from '@/lib/tipos'
import { FORMAS, esquemaMembro, paraCorpo, valoresIniciais, type DadosMembro } from './formulario'

// Volta para a aba "Integrantes" da Equipe (a de pagamentos é a padrão).
const LISTA = '/pagamentos?aba=equipe&vista=integrantes'

/** /equipe/novo e /equipe/:id (a pessoa vem da lista da equipe). */
export function PaginaMembro() {
  const { id } = useParams()
  const consulta = useEquipe()
  const membro = consulta.data?.find((m) => m.id === id)

  if (id && consulta.isPending) {
    return (
      <Pagina titulo="Editar pessoa">
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20" />
          ))}
        </div>
      </Pagina>
    )
  }
  if (id && !membro) {
    return (
      <Pagina titulo="Pessoa não encontrada">
        <p className="mb-4 text-lg">Esta pessoa não existe mais ou foi excluída.</p>
        <Button asChild variant="outline">
          <Link to={LISTA}>Voltar para a equipe</Link>
        </Button>
      </Pagina>
    )
  }
  return <FormularioMembro key={id ?? 'novo'} membro={membro} />
}

function FormularioMembro({ membro }: { membro?: MembroEquipe }) {
  const navegar = useNavigate()
  const salvarMembro = useSalvarMembro()
  const excluir = useExcluirMembro()
  const titulo = membro ? 'Editar pessoa' : 'Nova pessoa'

  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DadosMembro>({
    resolver: zodResolver(esquemaMembro),
    defaultValues: valoresIniciais(membro),
  })
  const dias = useFieldArray({ control, name: 'dias' })
  const erroDias = errors.dias?.message ?? errors.dias?.root?.message

  useEffect(() => {
    if (!membro) setFocus('nome')
  }, [membro, setFocus])

  async function salvar(dados: DadosMembro) {
    try {
      await salvarMembro.mutateAsync({ id: membro?.id, dados: paraCorpo(dados) })
      toast.success(membro ? 'Pessoa salva.' : 'Pessoa cadastrada. As contas dos dias de pagamento já foram criadas.')
      navegar(LISTA)
    } catch (erro) {
      aplicarErroApi(erro, setError, { porCodigo: { MEMBRO_DUPLICADO: 'nome' } })
    }
  }

  // Navega antes: a pessoa sai da lista em cache e esta tela deixaria de existir.
  function remover() {
    if (!membro) return
    navegar(LISTA)
    excluir.mutate(membro.id, { onSuccess: () => toast.success('Pessoa excluída.') })
  }

  return (
    <Pagina
      titulo={titulo}
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to={LISTA}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeftIcon weight="bold" className="size-5" aria-hidden />
            Salários equipe
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit(salvar)} className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Campo rotulo="Nome" placeholder="Ex.: Joana" erro={errors.nome?.message} {...register('nome')} />
          <Campo
            rotulo="Função (opcional)"
            placeholder="Ex.: Cuidadora, Cardiologista"
            erro={errors.funcao?.message}
            {...register('funcao')}
          />
        </div>

        <Controller
          control={control}
          name="formaPagamento"
          render={({ field }) => (
            <Opcoes<FormaPagamento>
              rotulo="Forma de receber"
              formato="segmentos"
              valor={field.value}
              aoMudar={field.onChange}
              opcoes={FORMAS}
            />
          )}
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-base font-semibold">Dias de pagamento</legend>
          <p className="text-base text-muted-foreground">
            O app cria a conta de cada dia, todo mês. Sem valor previsto, a conta vem como “a definir”.
          </p>
          {dias.fields.map((campo, i) => (
            <div key={campo.id} className="flex items-start gap-3">
              <Campo
                rotulo={`Dia (${i + 1}º pagamento)`}
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                className="w-24"
                erro={errors.dias?.[i]?.dia?.message}
                {...register(`dias.${i}.dia`)}
              />
              <Campo
                rotulo="Valor previsto (opcional)"
                prefixo="R$"
                inputMode="decimal"
                placeholder="0,00"
                erro={errors.dias?.[i]?.valor?.message}
                {...register(`dias.${i}.valor`)}
              />
              {dias.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-8 shrink-0"
                  aria-label={`Remover ${i + 1}º dia de pagamento`}
                  onClick={() => dias.remove(i)}
                >
                  <XIcon weight="bold" className="size-5" aria-hidden />
                </Button>
              )}
            </div>
          ))}
          {erroDias && <p className="text-base font-semibold text-destructive">{erroDias}</p>}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => dias.append({ dia: '', valor: '' })}
          >
            <PlusIcon weight="bold" aria-hidden />
            Outro dia
          </Button>
        </fieldset>

        <Campo
          rotulo="Chave PIX (opcional)"
          placeholder="CPF, celular, e-mail ou chave aleatória"
          erro={errors.chavePix?.message}
          {...register('chavePix')}
        />

        <Controller
          control={control}
          name="ativo"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-folha p-4 shadow-folha">
              <Label htmlFor="ativo" className="flex flex-col items-start gap-1 text-lg">
                Ativa
                <span className="text-base font-normal text-muted-foreground">
                  Desligue quando a pessoa deixar de trabalhar: as contas futuras somem, o histórico fica.
                </span>
              </Label>
              <Switch id="ativo" checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />

        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Salvando…' : membro ? 'Salvar alterações' : 'Cadastrar pessoa'}
          </Button>
          {membro && (
            <Confirmar
              gatilho={
                <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                  <TrashIcon aria-hidden />
                  Excluir pessoa
                </Button>
              }
              titulo="Excluir esta pessoa?"
              descricao={`${membro.nome} e as contas dela serão apagadas. Se ela já recebeu algum pagamento, desative em vez de excluir.`}
              confirmar="Excluir pessoa"
              aoConfirmar={remover}
            />
          )}
        </div>
      </form>
    </Pagina>
  )
}
