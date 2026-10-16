import { useEffect, useId, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
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
  useBaixarComprovante,
  useEnviarComprovante,
  useExcluirComprovante,
} from '@/consultas/pagamentos'
import { hojeISO, intervaloDoMes, mesDe } from '@/lib/datas'
import { formatarCentavos, paraCentavos } from '@/lib/dinheiro'
import { aplicarErroApi } from '@/lib/formulario'
import { useConvidarNotificacoes } from '@/consultas/notificacoes'
import type { PagamentoDetalhe } from '@/lib/tipos'
import { TAMANHO_MAXIMO_MB } from '@/lib/arquivos'
import { ListaArquivos, type TextosArquivos } from '@/components/ListaArquivos'
import { FormCategoria } from '@/paginas/categorias/FormCategoria'
import {
  camposDaApi,
  esquemaPagamento,
  paraCorpo,
  valoresIniciais,
  type DadosPagamento,
  type Repeticao,
} from './formulario'

/** Mesmo limite do back-end (src/modules/pagamentos/comprovantes.js). */
const MAXIMO_COMPROVANTES = 5

// Opção do <select> de categoria que abre o campo para digitar uma nova.
const NOVA_CATEGORIA = '__nova__'

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
  const fatura = consulta.data
  if (fatura?.cartaoId) {
    return (
      <Navigate
        replace
        to={`/pagamentos?aba=cartoes&cartao=${fatura.cartaoId}&mes=${fatura.competencia!.slice(0, 7)}`}
      />
    )
  }
  // key: ao trocar de pagamento, o formulário recomeça com os dados certos.
  return <FormularioPagamento key={id ?? 'novo'} pagamento={consulta.data} />
}

function FormularioPagamento({ pagamento }: { pagamento?: PagamentoDetalhe }) {
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
  // Aberto de uma aba de categoria: já vem com ela (e volta para ela ao salvar).
  const aba = params.get('aba') ?? ''
  // Aberto da sub-aba de um imóvel (Contas residenciais): já vem com ele.
  const imovel = params.get('imovel') ?? ''

  const { data: categorias = [] } = useCategorias()
  const [criandoCategoria, setCriandoCategoria] = useState(false)
  const { data: imoveis = [] } = useImoveis()
  const criar = useCriarPagamento()
  const editar = useEditarPagamento()
  const convidar = useConvidarNotificacoes()
  const excluir = useExcluirPagamento()

  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DadosPagamento>({
    resolver: zodResolver(esquemaPagamento),
    defaultValues: valoresIniciais(pagamento, vencimentoPadrao, aba, imovel),
  })

  const [repeticao, jaPago, valor, parcelas] = useWatch({
    control,
    name: ['repeticao', 'jaPago', 'valor', 'totalParcelas'],
  })
  const parcelado = repeticao === 'parcelado'
  const valorDigitado = paraCentavos(valor)
  const totalParcelas = Number(parcelas)

  useEffect(() => {
    if (!editando) setFocus('descricao')
  }, [editando, setFocus])

  // Controlado: a categoria criada no "+ Nova categoria…" é escolhida antes de a <option> dela
  // aparecer; sem `value`, o <select> descartaria o valor e ficaria na primeira opção.
  const categoriaId = useWatch({ control, name: 'categoriaId' })

  const enderecoDaLista = (vencimento: string) =>
    `/pagamentos?mes=${mesDe(vencimento)}${aba ? `&aba=${aba}` : ''}${imovel ? `&imovel=${imovel}` : ''}`
  const voltarParaLista = (vencimento: string) => navegar(enderecoDaLista(vencimento))
  const campoCategoria = register('categoriaId')

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
      // Conta pendente é lembrada na véspera e no dia do vencimento.
      if (corpo.status === 'pendente') void convidar()
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
            to={enderecoDaLista(pagamento?.vencimento ?? vencimentoPadrao)}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Contas
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{editando ? 'Editar pagamento' : 'Novo pagamento'}</h1>
        </div>
      }
    >
      <div className="flex flex-col gap-10">
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
            <div className="flex flex-col gap-3">
              <Selecao
                rotulo="Categoria"
                erro={errors.categoriaId?.message}
                {...campoCategoria}
                value={categoriaId}
                onChange={(e) => {
                  if (e.target.value !== NOVA_CATEGORIA) return campoCategoria.onChange(e)
                  setValue('categoriaId', '')
                  setCriandoCategoria(true)
                }}
              >
                <option value="" disabled>
                  Escolha a categoria
                </option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
                <option value={NOVA_CATEGORIA}>+ Nova categoria…</option>
              </Selecao>
              {criandoCategoria && (
                <div className="rounded-xl border bg-card p-4">
                  <FormCategoria
                    rotulo="Nome da nova categoria"
                    autoFocus
                    aoSalvar={(nova) => {
                      setValue('categoriaId', nova.id, { shouldValidate: true })
                      setCriandoCategoria(false)
                    }}
                    aoCancelar={() => setCriandoCategoria(false)}
                  />
                </div>
              )}
            </div>
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
        {pagamento && <Comprovantes pagamento={pagamento} />}
      </div>
    </Pagina>
  )
}

const TEXTOS_COMPROVANTES: TextosArquivos = {
  singular: 'comprovante',
  plural: 'comprovantes',
  cada: 'Cada conta',
  local: 'nesta conta',
  este: 'Esta conta',
  botao: 'Anexar comprovante',
}

/** Foto ou PDF do pagamento. Aberto por "Anexar comprovante" (#comprovantes), a tela rola até aqui. */
function Comprovantes({ pagamento }: { pagamento: PagamentoDetalhe }) {
  const enviar = useEnviarComprovante(pagamento.id)
  const baixar = useBaixarComprovante(pagamento.id)
  const excluir = useExcluirComprovante(pagamento.id)
  const { hash } = useLocation()
  const secao = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (hash === '#comprovantes') secao.current?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <div ref={secao} id="comprovantes" className="scroll-mt-4">
      <ListaArquivos
        titulo="Comprovantes"
        descricao={`Foto ou PDF do pagamento (até ${TAMANHO_MAXIMO_MB} MB cada).`}
        arquivos={pagamento.comprovantes}
        maximo={MAXIMO_COMPROVANTES}
        textos={TEXTOS_COMPROVANTES}
        enviar={enviar.mutateAsync}
        baixar={baixar.mutateAsync}
        excluir={(c) => excluir.mutateAsync(c.id)}
      />
    </div>
  )
}
