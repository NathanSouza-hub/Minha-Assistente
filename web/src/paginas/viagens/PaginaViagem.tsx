import { useEffect, useId, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeftIcon, TrashIcon } from '@phosphor-icons/react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useExcluirViagem, useSalvarViagem, useViagem } from '@/consultas/viagens'
import { aplicarErroApi } from '@/lib/formulario'
import type { Viagem } from '@/lib/tipos'
import { esquemaViagem, paraCorpo, valoresIniciais, type DadosViagem } from './formulario'

/** /viagens/nova e /viagens/:id/editar */
export function PaginaViagem() {
  const { id } = useParams()
  const consulta = useViagem(id)

  if (id && consulta.isPending) {
    return (
      <Pagina titulo="Editar viagem">
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
      <Pagina titulo="Viagem não encontrada">
        <p className="mb-4">Esta viagem não existe mais ou foi excluída.</p>
        <Button asChild variant="outline">
          <Link to="/viagens">Voltar para minhas viagens</Link>
        </Button>
      </Pagina>
    )
  }
  return <FormularioViagem key={id ?? 'nova'} viagem={consulta.data} />
}

function FormularioViagem({ viagem }: { viagem?: Viagem }) {
  const navegar = useNavigate()
  const editando = Boolean(viagem)
  const salvar = useSalvarViagem()
  const excluir = useExcluirViagem()
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DadosViagem>({ resolver: zodResolver(esquemaViagem), defaultValues: valoresIniciais(viagem) })

  useEffect(() => {
    if (!editando) setFocus('destino')
  }, [editando, setFocus])

  async function enviar(dados: DadosViagem) {
    try {
      const salva = await salvar.mutateAsync({ id: viagem?.id, dados: paraCorpo(dados) })
      toast.success(
        editando ? 'Viagem salva.' : 'Viagem cadastrada.',
        editando ? undefined : { description: 'Agora você pode anexar as passagens e os vouchers.' },
      )
      // Ao cadastrar, vai direto para a viagem: é lá que se anexam os arquivos.
      navegar(`/viagens/${salva.id}`, { replace: !editando })
    } catch (erro) {
      aplicarErroApi(erro, setError)
    }
  }

  function remover() {
    if (!viagem) return
    excluir.mutate(viagem.id, {
      onSuccess: () => {
        toast.success(`Viagem para ${viagem.destino} excluída.`)
        navegar('/viagens', { replace: true })
      },
    })
  }

  const ids = { hospedagem: useId(), transporte: useId(), observacoes: useId() }
  const titulo = editando ? 'Editar viagem' : 'Nova viagem'
  const anexos = viagem?.anexos.length ?? 0

  return (
    <Pagina
      titulo={titulo}
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to={viagem ? `/viagens/${viagem.id}` : '/viagens'}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeftIcon className="size-5" weight="bold" aria-hidden />
            {viagem ? viagem.destino : 'Viagens'}
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6">
        <Campo
          rotulo="Destino"
          placeholder="Ex.: Lisboa"
          erro={errors.destino?.message}
          {...register('destino')}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Campo rotulo="Ida" type="date" erro={errors.ida?.message} {...register('ida')} />
          <Campo
            rotulo="Volta (opcional)"
            type="date"
            dica="Deixe em branco se for só de ida."
            erro={errors.volta?.message}
            {...register('volta')}
          />
        </div>
        <CampoTexto
          id={ids.hospedagem}
          rotulo="Hospedagem (opcional)"
          placeholder="Ex.: Hotel Avenida, reserva 12345"
          erro={errors.hospedagem?.message}
          {...register('hospedagem')}
        />
        <CampoTexto
          id={ids.transporte}
          rotulo="Transporte (opcional)"
          placeholder="Ex.: Voo TP 088 às 23h40"
          erro={errors.transporte?.message}
          {...register('transporte')}
        />
        <CampoTexto
          id={ids.observacoes}
          rotulo="Observações (opcional)"
          placeholder="Ex.: levar adaptador de tomada"
          erro={errors.observacoes?.message}
          {...register('observacoes')}
        />

        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar viagem'}
          </Button>
          {viagem && (
            <Confirmar
              gatilho={
                <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                  <TrashIcon aria-hidden />
                  Excluir viagem
                </Button>
              }
              titulo={`Excluir a viagem para ${viagem.destino}?`}
              descricao={
                anexos === 0
                  ? 'Não dá para desfazer.'
                  : anexos === 1
                    ? 'O anexo também será apagado e não dá para recuperar.'
                    : `Os ${anexos} anexos também serão apagados e não dá para recuperar.`
              }
              confirmar="Excluir viagem"
              aoConfirmar={remover}
            />
          )}
        </div>
      </form>
    </Pagina>
  )
}

type PropsTexto = ComponentProps<typeof Textarea> & { id: string; rotulo: string; erro?: string }

function CampoTexto({ id, rotulo, erro, ...props }: PropsTexto) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Textarea
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        {...props}
      />
      {erro && (
        <p id={`${id}-erro`} className="text-base font-semibold text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}
