import { useEffect, useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowCounterClockwiseIcon, ArrowLeftIcon, CheckCircleIcon, TrashIcon } from '@phosphor-icons/react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { ListaArquivos, type TextosArquivos } from '@/components/ListaArquivos'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  useBaixarComprovanteRecebivel,
  useDesfazerRecebimento,
  useEnviarComprovanteRecebivel,
  useExcluirComprovanteRecebivel,
  useExcluirRecebivel,
  useReceber,
  useRecebivel,
  useSalvarRecebivel,
} from '@/consultas/recebiveis'
import { dataCurta, hojeISO } from '@/lib/datas'
import { formatarCentavos, paraCentavos } from '@/lib/dinheiro'
import { aplicarErroApi } from '@/lib/formulario'
import type { RecebivelDetalhe } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import {
  esquemaRecebimento,
  esquemaRecebivel,
  nomeDaOrigem,
  ORIGENS,
  paraCorpo,
  STATUS,
  valorDoCampo,
  valoresIniciais,
  type DadosRecebimento,
  type DadosRecebivel,
} from './formulario'

/** /recebiveis/novo e /recebiveis/:id */
export function PaginaRecebivel() {
  const { id } = useParams()
  const consulta = useRecebivel(id)

  if (id && consulta.isPending) {
    return (
      <Pagina titulo="Recebível">
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
      <Pagina titulo="Recebível não encontrado">
        <p className="mb-4 text-lg">Este recebível não existe mais ou foi excluído.</p>
        <Button asChild variant="outline">
          <Link to="/recebiveis">Voltar para recebíveis</Link>
        </Button>
      </Pagina>
    )
  }

  const recebivel = consulta.data
  const titulo = recebivel ? recebivel.descricao : 'Novo recebível'
  return (
    <Pagina
      titulo={titulo}
      cabecalho={
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to={`/recebiveis${recebivel ? `?mes=${recebivel.dataPrevista.slice(0, 7)}` : ''}`}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeftIcon className="size-5" weight="bold" aria-hidden />
            Recebíveis
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        </div>
      }
    >
      <div className="flex flex-col gap-10">
        {recebivel && <Situacao recebivel={recebivel} />}
        {recebivel && recebivel.status !== 'recebido' && <RegistrarRecebimento recebivel={recebivel} />}
        {recebivel && <Historico recebivel={recebivel} />}
        {recebivel && <Comprovantes recebivel={recebivel} />}
        <Formulario key={recebivel?.id ?? 'novo'} recebivel={recebivel} />
      </div>
    </Pagina>
  )
}

/** Previsto, recebido e o que falta, com a situação escrita (não só a cor). */
function Situacao({ recebivel: r }: { recebivel: RecebivelDetalhe }) {
  const cor = r.status === 'recebido' ? 'text-ok' : r.atrasado ? 'text-atraso' : 'text-alerta'
  return (
    <section aria-label="Situação" className="flex flex-col gap-3 rounded-2xl bg-folha p-4 shadow-folha">
      <p className={cn('flex items-center gap-2 text-lg font-bold', cor)}>
        {r.status === 'recebido' && <CheckCircleIcon className="size-6" weight="fill" aria-hidden />}
        {r.atrasado ? `${STATUS[r.status]} · atrasado` : STATUS[r.status]}
        {r.encerrado && r.recebidoCentavos < r.valorPrevistoCentavos && ' (encerrado com menos)'}
      </p>
      {/* Celular estreito: uma linha por número; a partir de 520px, três colunas. */}
      <dl className="grid gap-1 min-[520px]:grid-cols-3 min-[520px]:gap-2">
        {[
          { rotulo: 'Previsto', valor: r.valorPrevistoCentavos, cor: '' },
          { rotulo: 'Recebido', valor: r.recebidoCentavos, cor: 'text-ok' },
          { rotulo: 'Falta', valor: r.saldoCentavos, cor: '' },
        ].map((i) => (
          <div key={i.rotulo} className="flex items-baseline justify-between gap-3 min-[520px]:block">
            <dt className="text-base text-muted-foreground">{i.rotulo}</dt>
            <dd className={cn('font-bold tabular-nums', i.cor)}>{formatarCentavos(i.valor)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-base text-muted-foreground">
        {nomeDaOrigem(r)} · previsto para {dataCurta(r.dataPrevista)}
        {r.recorrencia !== 'nenhuma' && ` · ${r.recorrencia === 'mensal' ? 'todo mês' : 'todo ano'}`}
      </p>
    </section>
  )
}

/** Recebimento parcial ou total. O valor já vem com o que falta. */
function RegistrarRecebimento({ recebivel: r }: { recebivel: RecebivelDetalhe }) {
  const receber = useReceber(r.id)
  const idObs = useId()
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DadosRecebimento>({
    resolver: zodResolver(esquemaRecebimento),
    defaultValues: { valor: valorDoCampo(r.saldoCentavos), data: hojeISO(), observacoes: '', encerrar: false },
  })
  const valorDigitado = useWatch({ control, name: 'valor' })
  const menorQueSaldo = (paraCentavos(valorDigitado) ?? 0) < r.saldoCentavos

  async function enviar(d: DadosRecebimento) {
    try {
      const detalhe = await receber.mutateAsync({
        valorCentavos: paraCentavos(d.valor)!,
        data: d.data,
        observacoes: d.observacoes.trim() || null,
        encerrar: d.encerrar,
      })
      toast.success(detalhe.status === 'recebido' ? 'Pronto, valor recebido.' : 'Recebimento registrado.')
      reset({ valor: valorDoCampo(detalhe.saldoCentavos), data: hojeISO(), observacoes: '', encerrar: false })
    } catch (erro) {
      aplicarErroApi(erro, setError, { campos: { valorCentavos: 'valor' } })
    }
  }

  return (
    <section aria-labelledby="titulo-receber" className="flex flex-col gap-4">
      <h2 id="titulo-receber" className="text-xl font-bold">
        Registrar recebimento
      </h2>
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            rotulo="Valor recebido"
            prefixo="R$"
            inputMode="decimal"
            dica="Pode ser só uma parte: o resto continua a receber."
            erro={errors.valor?.message}
            {...register('valor')}
          />
          <Campo rotulo="Data do recebimento" type="date" erro={errors.data?.message} {...register('data')} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={idObs}>Observações (opcional)</Label>
          <Textarea id={idObs} {...register('observacoes')} />
        </div>
        {menorQueSaldo && (
          <Controller
            control={control}
            name="encerrar"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4 rounded-xl bg-suave/70 p-4">
                <Label htmlFor="encerrar" className="leading-snug">
                  Foi o valor final (dar por recebido mesmo com menos que o previsto)
                </Label>
                <Switch id="encerrar" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        )}
        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}
        <Button
          type="submit"
          variant="confirmar"
          size="lg"
          disabled={isSubmitting}
          className="w-full sm:w-auto sm:self-start"
        >
          <CheckCircleIcon aria-hidden />
          {isSubmitting ? 'Registrando…' : 'Registrar recebimento'}
        </Button>
      </form>
    </section>
  )
}

/** Histórico de recebimentos; desfazer reabre o recebível. */
function Historico({ recebivel: r }: { recebivel: RecebivelDetalhe }) {
  const desfazer = useDesfazerRecebimento(r.id)
  return (
    <section aria-labelledby="titulo-historico" className="flex flex-col gap-3">
      <h2 id="titulo-historico" className="text-xl font-bold">
        Histórico de recebimentos
      </h2>
      {r.recebimentos.length === 0 ? (
        <p className="text-muted-foreground">Nada recebido ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-linha">
          {r.recebimentos.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold tabular-nums">{formatarCentavos(m.valorCentavos)}</span>
                <span className="text-base text-muted-foreground">
                  {dataCurta(m.data)}
                  {m.observacoes && ` · ${m.observacoes}`}
                </span>
              </span>
              <Confirmar
                gatilho={
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Desfazer recebimento de ${formatarCentavos(m.valorCentavos)}`}
                  >
                    <ArrowCounterClockwiseIcon aria-hidden />
                    Desfazer
                  </Button>
                }
                titulo="Desfazer este recebimento?"
                descricao="O valor sai do histórico e o recebível volta a ficar em aberto."
                confirmar="Desfazer recebimento"
                aoConfirmar={() => desfazer.mutate(m.id, { onSuccess: () => toast.success('Recebimento desfeito.') })}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const TEXTOS_COMPROVANTES: TextosArquivos = {
  singular: 'comprovante',
  plural: 'comprovantes',
  cada: 'Cada recebível',
  local: 'neste recebível',
  este: 'Este recebível',
  botao: 'Anexar comprovante',
}

function Comprovantes({ recebivel: r }: { recebivel: RecebivelDetalhe }) {
  const enviar = useEnviarComprovanteRecebivel(r.id)
  const baixar = useBaixarComprovanteRecebivel(r.id)
  const excluir = useExcluirComprovanteRecebivel(r.id)
  return (
    <ListaArquivos
      titulo="Comprovantes"
      descricao="Extrato, recibo ou aviso de crédito (foto ou PDF)."
      arquivos={r.comprovantes}
      maximo={5}
      textos={TEXTOS_COMPROVANTES}
      enviar={enviar.mutateAsync}
      baixar={baixar.mutateAsync}
      excluir={(c) => excluir.mutateAsync(c.id)}
    />
  )
}

function Formulario({ recebivel }: { recebivel?: RecebivelDetalhe }) {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const editando = Boolean(recebivel)
  const salvar = useSalvarRecebivel()
  const excluir = useExcluirRecebivel()
  const idObs = useId()
  // Novo a partir de um mês da lista: a data prevista começa hoje se for o mês atual, senão no dia 1.
  const mes = params.get('mes')
  const dataPadrao = !mes || hojeISO().startsWith(mes) ? hojeISO() : `${mes}-01`
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    setError,
    setFocus,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DadosRecebivel>({
    resolver: zodResolver(esquemaRecebivel),
    defaultValues: valoresIniciais(recebivel, dataPadrao),
  })
  const origem = useWatch({ control, name: 'origem' })

  useEffect(() => {
    if (!editando) setFocus('descricao')
  }, [editando, setFocus])

  // "Especifique a origem" só vale em "Outros": trocar de origem apaga o que foi digitado.
  useEffect(() => {
    if (origem !== 'outros' && getValues('origemDescricao')) setValue('origemDescricao', '')
  }, [origem, getValues, setValue])

  async function enviar(dados: DadosRecebivel) {
    try {
      const salvo = await salvar.mutateAsync({ id: recebivel?.id, dados: paraCorpo(dados) })
      toast.success(editando ? 'Recebível salvo.' : 'Recebível cadastrado.')
      if (!editando) navegar(`/recebiveis/${salvo.id}`, { replace: true })
    } catch (erro) {
      aplicarErroApi(erro, setError, { campos: { valorPrevistoCentavos: 'valor' } })
    }
  }

  function remover() {
    if (!recebivel) return
    excluir.mutate(recebivel.id, {
      onSuccess: () => {
        toast.success(`${recebivel.descricao} excluído.`)
        navegar(`/recebiveis?mes=${recebivel.dataPrevista.slice(0, 7)}`, { replace: true })
      },
    })
  }

  return (
    <section aria-labelledby={editando ? 'titulo-dados' : undefined} className="flex flex-col gap-4">
      {editando && (
        <h2 id="titulo-dados" className="text-xl font-bold">
          Dados do recebível
        </h2>
      )}
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6">
        <Campo
          rotulo="Descrição"
          placeholder="Ex.: Aluguel da sala comercial"
          erro={errors.descricao?.message}
          {...register('descricao')}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Selecao rotulo="Origem" erro={errors.origem?.message} {...register('origem')}>
              {Object.entries(ORIGENS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Selecao>
            {origem === 'outros' && (
              <Campo
                rotulo="Especifique a origem"
                placeholder="Ex.: Juros de empréstimo, reembolso, venda de veículo"
                erro={errors.origemDescricao?.message}
                {...register('origemDescricao')}
              />
            )}
          </div>
          <Campo
            rotulo="Valor previsto"
            prefixo="R$"
            inputMode="decimal"
            placeholder="0,00"
            erro={errors.valor?.message}
            {...register('valor')}
          />
          <Campo rotulo="Data prevista" type="date" erro={errors.dataPrevista?.message} {...register('dataPrevista')} />
          <Selecao
            rotulo="Repetir"
            dica="Ao receber, o próximo é criado sozinho. Para valores que variam (ex.: dividendos), deixe sem repetir."
            {...register('recorrencia')}
          >
            <option value="nenhuma">Não repete</option>
            <option value="mensal">Todo mês</option>
            <option value="anual">Todo ano</option>
          </Selecao>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={idObs}>Observações (opcional)</Label>
          <Textarea id={idObs} {...register('observacoes')} />
        </div>

        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || (editando && !isDirty)}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar recebível'}
          </Button>
          {recebivel && (
            <Confirmar
              gatilho={
                <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                  <TrashIcon aria-hidden />
                  Excluir recebível
                </Button>
              }
              titulo={`Excluir ${recebivel.descricao}?`}
              descricao="O histórico de recebimentos e os comprovantes também serão apagados. Não dá para desfazer."
              confirmar="Excluir recebível"
              aoConfirmar={remover}
            />
          )}
        </div>
      </form>
    </section>
  )
}
