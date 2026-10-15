import { useEffect, useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useCartoes, useCompraCartao, useExcluirCompra, useSalvarCompra } from '@/consultas/cartoes'
import { useCategorias } from '@/consultas/pagamentos'
import { nomeDoMes } from '@/lib/datas'
import { formatarCentavos, paraCentavos } from '@/lib/dinheiro'
import { primeiraCompetencia, valoresDasParcelas } from '@/lib/fatura'
import { aplicarErroApi } from '@/lib/formulario'
import type { Cartao, CompraCartao } from '@/lib/tipos'
import { camposDaApiCompra, compraParaCorpo, esquemaCompra, valoresIniciaisCompra, type DadosCompra } from './formulario'

/** "10× de R$ 25,00" ou, quando sobram centavos, "1ª de R$ 3,34 e 2× de R$ 3,33". */
function resumoDasParcelas(totalCentavos: number, parcelas: number) {
  const [primeira, demais] = valoresDasParcelas(totalCentavos, parcelas)
  if (parcelas === 1) return `À vista, ${formatarCentavos(primeira)}`
  if (primeira === demais) return `${parcelas}× de ${formatarCentavos(primeira)}`
  return `1ª de ${formatarCentavos(primeira)} e ${parcelas - 1}× de ${formatarCentavos(demais)}`
}

/** /cartoes/:id/compras/nova e /cartoes/:id/compras/:compraId */
export function PaginaCompra() {
  const { id = '', compraId } = useParams()
  const cartoes = useCartoes()
  const cartao = cartoes.data?.find((c) => c.id === id)
  const compra = useCompraCartao(id, compraId)
  const voltar = `/pagamentos?aba=cartoes&cartao=${id}`

  if (cartoes.isPending || (compraId && compra.isPending)) {
    return (
      <Pagina titulo="Compra no cartão">
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20" />
          ))}
        </div>
      </Pagina>
    )
  }
  if (!cartao || (compraId && compra.isError)) {
    return (
      <Pagina titulo="Compra não encontrada">
        <p className="mb-4 text-lg">Esta compra ou este cartão não existe mais.</p>
        <Button asChild variant="outline">
          <Link to={voltar}>Voltar para os cartões</Link>
        </Button>
      </Pagina>
    )
  }
  return <FormularioCompra key={compraId ?? 'nova'} cartao={cartao} compra={compra.data} />
}

function FormularioCompra({ cartao, compra }: { cartao: Cartao; compra?: CompraCartao }) {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const { data: categorias = [] } = useCategorias()
  const salvarCompra = useSalvarCompra()
  const excluir = useExcluirCompra()
  const titulo = compra ? 'Editar compra' : 'Nova compra'
  const idObs = useId()

  // Volta para o mês de onde veio (ou o da primeira parcela, depois de salvar).
  const listaNoMes = (mes?: string | null) =>
    `/pagamentos?aba=cartoes&cartao=${cartao.id}${mes ? `&mes=${mes}` : ''}`

  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DadosCompra>({
    resolver: zodResolver(esquemaCompra),
    defaultValues: valoresIniciaisCompra(compra),
  })

  const [valor, parcelas, dataCompra] = useWatch({ control, name: ['valor', 'parcelas', 'dataCompra'] })
  const total = paraCentavos(valor)
  const quantidade = Number(parcelas)
  const parcelasValidas = Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= 48
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(dataCompra)

  useEffect(() => {
    if (!compra) setFocus('descricao')
  }, [compra, setFocus])

  async function salvar(dados: DadosCompra) {
    try {
      const salva = await salvarCompra.mutateAsync({
        cartaoId: cartao.id,
        compraId: compra?.id,
        dados: compraParaCorpo(dados),
      })
      toast.success(compra ? 'Compra salva.' : 'Compra lançada.')
      navegar(listaNoMes(salva.competencias[0].slice(0, 7)))
    } catch (erro) {
      // FATURA_PAGA e outros erros sem campo aparecem no fim do formulário.
      aplicarErroApi(erro, setError, { campos: camposDaApiCompra })
    }
  }

  // Navega antes: a compra sai do cache e esta tela deixaria de existir.
  function remover() {
    if (!compra) return
    navegar(listaNoMes(params.get('mes') ?? compra.competencias[0].slice(0, 7)))
    excluir.mutate({ cartaoId: cartao.id, compraId: compra.id }, { onSuccess: () => toast.success('Compra excluída.') })
  }

  return (
    <Pagina
      titulo={titulo}
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to={listaNoMes(params.get('mes'))}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeft className="size-5" aria-hidden />
            {cartao.nome}
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit(salvar)} className="flex flex-col gap-6">
        <Campo rotulo="Descrição" placeholder="Ex.: Farmácia" erro={errors.descricao?.message} {...register('descricao')} />

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo
            rotulo="Valor total"
            prefixo="R$"
            inputMode="decimal"
            placeholder="0,00"
            erro={errors.valor?.message}
            {...register('valor')}
          />
          <Campo
            rotulo="Parcelas"
            type="number"
            inputMode="numeric"
            min={1}
            max={48}
            erro={errors.parcelas?.message}
            {...register('parcelas')}
          />
        </div>
        {total && total > 0 && parcelasValidas ? (
          <p className="-mt-3 text-base text-muted-foreground" aria-live="polite">
            {resumoDasParcelas(total, quantidade)}
            {dataValida &&
              `, a primeira na fatura de ${nomeDoMes(primeiraCompetencia(cartao, dataCompra).slice(0, 7)).toLowerCase()}`}
            .
          </p>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo rotulo="Data da compra" type="date" erro={errors.dataCompra?.message} {...register('dataCompra')} />
          <Selecao rotulo="Categoria (opcional)" {...register('categoriaId')}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={idObs}>Observações (opcional)</Label>
          <Textarea id={idObs} aria-invalid={errors.observacoes ? true : undefined} {...register('observacoes')} />
          {errors.observacoes && (
            <p className="text-base font-semibold text-destructive">{errors.observacoes.message}</p>
          )}
        </div>

        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Salvando…' : compra ? 'Salvar alterações' : 'Lançar compra'}
          </Button>
          {compra && (
            <Confirmar
              gatilho={
                <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                  <Trash2 aria-hidden />
                  Excluir compra
                </Button>
              }
              titulo="Excluir esta compra?"
              descricao={`${compra.descricao} sai de todas as faturas em que tem parcela.`}
              confirmar="Excluir compra"
              aoConfirmar={remover}
            />
          )}
        </div>
      </form>
    </Pagina>
  )
}
