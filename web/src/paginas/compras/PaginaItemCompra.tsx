import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeftIcon, TrashIcon } from '@phosphor-icons/react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCompras, useExcluirItem, useSalvarItem } from '@/consultas/compras'
import { aplicarErroApi } from '@/lib/formulario'
import type { ItemCompra } from '@/lib/tipos'
import { CamposExtras } from './CamposExtras'
import { esquemaItem, paraCorpo, sugerirCategorias, valoresIniciais, type DadosItem } from './formulario'

/** /compras/:id — a lista já traz tudo; o back-end não tem GET /compras/:id. */
export function PaginaItemCompra() {
  const { id } = useParams()
  const consulta = useCompras()
  const item = consulta.data?.find((i) => i.id === id)

  if (consulta.isPending) {
    return (
      <Pagina titulo="Editar item">
        <Skeleton className="h-60" />
      </Pagina>
    )
  }
  if (!item) {
    return (
      <Pagina titulo="Item não encontrado">
        <p className="mb-4">Este item não existe mais ou foi tirado da lista.</p>
        <Button asChild variant="outline">
          <Link to="/compras">Voltar para a lista</Link>
        </Button>
      </Pagina>
    )
  }
  return <FormularioItem key={item.id} item={item} categorias={sugerirCategorias(consulta.data ?? [])} />
}

function FormularioItem({ item, categorias }: { item: ItemCompra; categorias: string[] }) {
  const navegar = useNavigate()
  const salvar = useSalvarItem()
  const excluir = useExcluirItem()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosItem>({ resolver: zodResolver(esquemaItem), defaultValues: valoresIniciais(item) })

  async function enviar(dados: DadosItem) {
    try {
      await salvar.mutateAsync({ id: item.id, dados: paraCorpo(dados) })
      toast.success('Item salvo.')
      navegar('/compras')
    } catch (erro) {
      aplicarErroApi(erro, setError)
    }
  }

  function remover() {
    // Esta tela lê o item da lista: quando ele sai do cache, a tela vira "não encontrado" e
    // desmonta. Por isso volta para a lista antes, e o aviso fica preso à promessa (que resolve
    // mesmo com a tela já desmontada). O erro já vira aviso pelo cache de mutações.
    const exclusao = excluir.mutateAsync(item.id)
    navegar('/compras', { replace: true })
    exclusao.then(() => toast.success(`${item.nome} tirado da lista.`)).catch(() => {})
  }

  return (
    <Pagina
      titulo="Editar item"
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to="/compras"
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeftIcon className="size-5" weight="bold" aria-hidden />
            Compras
          </Link>
          <h1 className="text-3xl leading-tight font-bold">Editar item</h1>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6">
        <Campo rotulo="Item" autoComplete="off" erro={errors.nome?.message} {...register('nome')} />
        <CamposExtras register={register} errors={errors} categorias={categorias} />

        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Salvando…' : 'Salvar alterações'}
          </Button>
          <Confirmar
            gatilho={
              <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                <TrashIcon aria-hidden />
                Tirar da lista
              </Button>
            }
            titulo={`Tirar ${item.nome} da lista?`}
            descricao="Para comprar depois, é só adicionar outra vez."
            confirmar="Tirar da lista"
            aoConfirmar={remover}
          />
        </div>
      </form>
    </Pagina>
  )
}
