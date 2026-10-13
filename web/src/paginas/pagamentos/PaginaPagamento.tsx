import { useEffect, useId } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Opcoes } from '@/components/Opcoes'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  useCategorias,
  useCriarPagamento,
  useEditarPagamento,
  useExcluirPagamento,
  useImoveis,
  usePagamento,
} from '@/consultas/pagamentos'
import { hojeISO, intervaloDoMes, mesDe } from '@/lib/datas'
import { formatarCentavos, paraCentavos } from '@/lib/dinheiro'
import { aplicarErroApi } from '@/lib/formulario'
import type { Pagamento } from '@/lib/tipos'
import {
  camposDaApi,
  esquemaPagamento,
  paraCorpo,
  valoresIniciais,
  type DadosPagamento,
  type Repeticao,
} from './formulario'

/** /pagamentos/novo e /pagamentos/:id */
export function PaginaPagamento() {
  const { id } = useParams()
  const consulta = usePagamento(id)

  if (id && consulta.isPending) {
    return (
      <Pagina titulo="Editar pagamento">
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-20" />
          ))}
        </div>
      </Pagina>
    )
  }
  if (id && consulta.isError) {
    return (
      <Pagina titulo="Pagamento não encontrado">
        <p className="mb-4 text-lg">Este pagamento não existe mais ou foi excluído.</p>
        <Button asChild variant="outline">
          <Link to="/pagamentos">Voltar para pagamentos</Link>
        </Button>
      </Pagina>
    )
  }
  // key: ao trocar de pagamento, o formulário recomeça com os dados certos.
  return <FormularioPagamento key={id ?? 'novo'} pagamento={consulta.data} />
}

function FormularioPagamento({ pagamento }: { pagamento?: Pagamento }) {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const editando = Boolean(pagamento)
  const ehParcela = Boolean(pagamento?.parcelaTotal)

  // Novo pagamento aberto a partir de outro mês já vem com uma data daquele mês.
  const mesDaLista = params.get('mes')
  const vencimentoPadrao =
    mesDaLista && mesDaLista !== mesDe() && /^\d{4}-\d{2}$/.test(mesDaLista)
      ? intervaloDoMes(mesDaLista).inicio
      : hojeISO()

  const { data: categorias = [] } = useCategorias()
  const { data: imoveis = [] } = useImoveis()
  const criar = useCriarPagamento()
  const editar = useEditarPagamento()
  const excluir = useExcluirPagamento()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DadosPagamento>({
    resolver: zodResolver(esquemaPagamento),
    defaultValues: valoresIniciais(pagamento, vencimentoPadrao),
  })

  const repeticao = watch('repeticao')
  const jaPago = watch('jaPago')
  const parcelado = repeticao === 'parcelado'
  const valorDigitado = paraCentavos(watch('valor'))
  const totalParcelas = Number(watch('totalParcelas'))

  useEffect(() => {
    if (!editando) setFocus('descricao')
  }, [editando, setFocus])

  const voltarParaLista = (vencimento: string) => navegar(`/pagamentos?mes=${mesDe(vencimento)}`)

  async function salvar(dados: DadosPagamento) {
    const corpo = paraCorpo(dados)
    const opcoesErro = { campos: camposDaApi }
    try {
      if (pagamento) {
        const { parcelamento: _p, ...edicao } = corpo
        await editar.mutateAsync({ id: pagamento.id, dados: edicao })
        toast.success('Pagamento salvo.')
      } else {
        const criados = await criar.mutateAsync(corpo)
        toast.success(criados.length > 1 ? `${criados.length} parcelas criadas.` : 'Pagamento criado.')
      }
      voltarParaLista(corpo.vencimento)
    } catch (erro) {
      aplicarErroApi(erro, setError, opcoesErro)
    }
  }

  function remover() {
    if (!pagamento) return
    excluir.mutate(pagamento.id, {
      onSuccess: () => {
        toast.success('Pagamento excluído.')
        voltarParaLista(pagamento.vencimento)
      },
    })
  }

  const opcoesRepeticao: { valor: Repeticao; rotulo: string; descricao?: string }[] = [
    { valor: 'nenhuma', rotulo: 'Só esta vez' },
    { valor: 'mensal', rotulo: 'Todo mês', descricao: 'Ao pagar, a do mês seguinte é criada.' },
    { valor: 'anual', rotulo: 'Todo ano', descricao: 'Ao pagar, a do ano seguinte é criada.' },
    ...(editando
      ? []
      : [{ valor: 'parcelado' as const, rotulo: 'Parcelado', descricao: 'Cria todas as parcelas de uma vez.' }]),
  ]

  const idObs = useId()

  return (
    <Pagina
      titulo={editando ? 'Editar pagamento' : 'Novo pagamento'}
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to={`/pagamentos?mes=${mesDe(pagamento?.vencimento ?? vencimentoPadrao)}`}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Pagamentos
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{editando ? 'Editar pagamento' : 'Novo pagamento'}</h1>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit(salvar)} className="flex flex-col gap-6">
        <Campo rotulo="Descrição" placeholder="Ex.: Condomínio" erro={errors.descricao?.message} {...register('descricao')} />

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo
            rotulo={parcelado ? 'Valor de cada parcela' : 'Valor'}
            prefixo="R$"
            inputMode="decimal"
            placeholder="0,00"
            erro={errors.valor?.message}
            {...register('valor')}
          />
          <Campo
            rotulo={parcelado ? 'Vencimento da 1ª parcela' : 'Vencimento'}
            type="date"
            erro={errors.vencimento?.message}
            {...register('vencimento')}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Selecao rotulo="Categoria" erro={errors.categoriaId?.message} {...register('categoriaId')}>
            <option value="" disabled>
              Escolha a categoria
            </option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Imóvel (opcional)"
            dica={
              imoveis.length === 0 ? (
                <Link to="/imoveis" className="font-semibold text-primary underline underline-offset-4">
                  Cadastrar imóvel
                </Link>
              ) : undefined
            }
            {...register('imovelId')}
          >
            <option value="">Nenhum</option>
            {imoveis.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </Selecao>
        </div>

        {ehParcela ? (
          <p className="rounded-lg bg-muted px-4 py-3">
            Parcela <strong>{pagamento!.parcelaAtual}</strong> de <strong>{pagamento!.parcelaTotal}</strong>. As
            mudanças valem só para esta parcela.
          </p>
        ) : (
          <Controller
            control={control}
            name="repeticao"
            render={({ field }) => (
              <Opcoes<Repeticao>
                rotulo="Repete?"
                valor={field.value}
                aoMudar={field.onChange}
                opcoes={opcoesRepeticao}
                erro={errors.repeticao?.message}
              />
            )}
          />
        )}

        {parcelado && (
          <div className="flex flex-col gap-2">
            <Campo
              rotulo="Quantas parcelas?"
              type="number"
              inputMode="numeric"
              min={2}
              max={120}
              erro={errors.totalParcelas?.message}
              {...register('totalParcelas')}
            />
            {valorDigitado && totalParcelas >= 2 && (
              <p className="text-base text-muted-foreground" aria-live="polite">
                {totalParcelas} parcelas de {formatarCentavos(valorDigitado)}, total de{' '}
                {formatarCentavos(valorDigitado * totalParcelas)}.
              </p>
            )}
          </div>
        )}

        {!parcelado && (
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
            <Controller
              control={control}
              name="jaPago"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="ja-pago" className="text-lg">
                    Já foi pago
                  </Label>
                  <Switch id="ja-pago" checked={field.value} onCheckedChange={field.onChange} />
                </div>
              )}
            />
            {jaPago && (
              <Campo
                rotulo="Data do pagamento"
                type="date"
                erro={errors.dataPagamento?.message}
                {...register('dataPagamento')}
              />
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor={idObs}>Observações (opcional)</Label>
          <Textarea
            id={idObs}
            aria-invalid={errors.observacoes ? true : undefined}
            {...register('observacoes')}
          />
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
            {isSubmitting
              ? 'Salvando…'
              : editando
                ? 'Salvar alterações'
                : parcelado
                  ? 'Criar parcelas'
                  : 'Criar pagamento'}
          </Button>
          {pagamento && (
            <Confirmar
              gatilho={
                <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                  <Trash2 aria-hidden />
                  Excluir pagamento
                </Button>
              }
              titulo="Excluir este pagamento?"
              descricao={
                ehParcela
                  ? 'Só esta parcela será excluída. As outras continuam.'
                  : `${pagamento.descricao} de ${formatarCentavos(pagamento.valorCentavos)} será apagado e não dá para desfazer.`
              }
              confirmar="Excluir pagamento"
              aoConfirmar={remover}
            />
          )}
        </div>
      </form>
    </Pagina>
  )
}
