import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeftIcon,
  BuildingsIcon,
  PaperclipIcon,
  PlusIcon,
} from '@phosphor-icons/react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Abas } from '@/components/Abas'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { BarraPago, PagoPendente, SituacaoContas } from '@/components/ResumoValores'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useImovel, usePagamentos, useRelatorioImovel, useSalvarImovel } from '@/consultas/pagamentos'
import { deDataISO, intervaloDoMes, mesDe, somarMeses } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import { aplicarErroApi } from '@/lib/formulario'
import type { Imovel, RelatorioImovel } from '@/lib/tipos'
import { ItemPagamento } from '@/paginas/pagamentos/ItemPagamento'

type Periodo = 'mes' | 'semestre' | 'ano'
type AbaImovel = 'resumo' | 'contas' | 'dados'

/** Período escolhido → datas (pelo vencimento das contas). */
function datasDo(periodo: Periodo) {
  const mes = mesDe()
  if (periodo === 'mes') return intervaloDoMes(mes)
  if (periodo === 'semestre') return { inicio: intervaloDoMes(somarMeses(mes, -5)).inicio, fim: intervaloDoMes(mes).fim }
  return { inicio: `${mes.slice(0, 4)}-01-01`, fim: `${mes.slice(0, 4)}-12-31` }
}

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'semestre', rotulo: '6 meses' },
  { valor: 'ano', rotulo: 'Este ano' },
]

/** /imoveis/:id: quanto o imóvel custa no período, por categoria e mês a mês, e as contas dele. */
export function DetalheImovel() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const periodo = (PERIODOS.some((p) => p.valor === params.get('periodo')) ? params.get('periodo') : 'mes') as Periodo
  const datas = datasDo(periodo)
  const imovel = useImovel(id)
  const resumo = useRelatorioImovel(id, datas)
  const contas = usePagamentos({ imovelId: id, ...datas })
  // Trocar o período não sai da aba aberta (`?vista=`).
  const mudarPeriodo = (v: Periodo) =>
    setParams(
      (antes) => {
        const novo = new URLSearchParams(antes)
        if (v === 'mes') novo.delete('periodo')
        else novo.set('periodo', v)
        return novo
      },
      { replace: true },
    )

  if (imovel.isError) {
    return (
      <Pagina titulo="Imóvel não encontrado">
        <p className="mb-4">Este imóvel não existe mais ou foi excluído.</p>
        <Button asChild variant="outline">
          <Link to="/imoveis">Voltar para imóveis</Link>
        </Button>
      </Pagina>
    )
  }

  const dados = imovel.data
  const identificacao = [dados?.endereco, dados?.complemento].filter(Boolean).join(' · ')
  return (
    <Pagina
      titulo={dados?.nome ?? 'Imóvel'}
      area="contas"
      larga
      cabecalho={
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to="/imoveis"
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeftIcon className="size-5" weight="bold" aria-hidden />
            Imóveis
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{dados?.nome ?? '…'}</h1>
          {identificacao && <p className="text-lg text-muted-foreground">{identificacao}</p>}
        </div>
      }
      acoes={
        <Button asChild variant="secondary">
          <Link to={`/pagamentos/novo?mes=${mesDe()}&imovel=${id}`}>
            <PlusIcon weight="bold" aria-hidden />
            Conta
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Opcoes<Periodo>
          rotulo="Período"
          rotuloOculto
          formato="segmentos"
          valor={periodo}
          aoMudar={mudarPeriodo}
          opcoes={PERIODOS}
        />

        <Abas<AbaImovel>
          rotulo={`Partes de ${dados?.nome ?? 'imóvel'}`}
          abas={[
            {
              valor: 'resumo',
              rotulo: 'Resumo',
              conteudo: resumo.isPending ? (
                <div role="status" aria-label="Carregando o resumo" className="flex flex-col gap-3">
                  <Skeleton className="h-32" />
                  <Skeleton className="h-24" />
                </div>
              ) : resumo.isError ? (
                <EstadoVazio
                  icone={BuildingsIcon}
                  titulo="Não foi possível carregar o resumo"
                  acao={<Button onClick={() => resumo.refetch()}>Tentar de novo</Button>}
                />
              ) : (
                <Resumo r={resumo.data} />
              ),
            },
            {
              valor: 'contas',
              rotulo: 'Contas',
              contador: contas.data?.length,
              conteudo: (
                <section aria-labelledby="titulo-contas" className="flex flex-col gap-2">
                  <h2 id="titulo-contas" className="text-secao font-bold">
                    Contas do período
                  </h2>
                  {contas.isPending ? (
                    <Skeleton className="h-24" />
                  ) : (contas.data ?? []).length === 0 ? (
                    <p className="text-muted-foreground">Nenhuma conta deste imóvel no período.</p>
                  ) : (
                    <ul className="superficie flex flex-col divide-y divide-linha overflow-hidden">
                      {[...contas.data!].reverse().map((p) => (
                        <ItemPagamento key={p.id} pagamento={p} />
                      ))}
                    </ul>
                  )}
                </section>
              ),
            },
            {
              valor: 'dados',
              rotulo: 'Dados do imóvel',
              conteudo: dados ? <DadosImovel key={dados.id} imovel={dados} /> : <Skeleton className="h-64" />,
            },
          ]}
        />
      </div>
    </Pagina>
  )
}

const nomeCurtoDoMes = (mes: string) => deDataISO(`${mes}-01`).toFormat('LLL/yy').replace('.', '')

function Resumo({ r }: { r: RelatorioImovel }) {
  const maiorCategoria = Math.max(...r.categorias.map((c) => c.totalCentavos), 1)
  const maiorMes = Math.max(...r.meses.map((m) => m.totalCentavos), 1)
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Resumo do período" className="superficie flex flex-col gap-3 p-4">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">Total do período</span>
          <span className="text-destaque font-bold tabular-nums">{formatarCentavos(r.totalCentavos)}</span>
        </p>
        <BarraPago v={r} />
        <PagoPendente v={r} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-base">
          <SituacaoContas v={r} vazio="Sem contas no período" />
          {r.vencidoCentavos > 0 && (
            <span className="font-semibold text-atraso">{formatarCentavos(r.vencidoCentavos)} vencidos</span>
          )}
          {r.totalComprovantes > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <PaperclipIcon className="size-5" aria-hidden />
              {r.totalComprovantes === 1 ? '1 comprovante' : `${r.totalComprovantes} comprovantes`}
            </span>
          )}
        </div>
      </section>

      {/* Por categoria e mês a mês lado a lado no computador. */}
      <div className="grid items-start gap-5 md:grid-cols-2">
        {r.categorias.length > 0 && (
          <section
            aria-labelledby="titulo-categorias"
            className="superficie flex flex-col gap-3 p-4"
          >
            <h2 id="titulo-categorias" className="text-secao font-bold">
              Por categoria
            </h2>
            <ul className="flex flex-col gap-3">
              {r.categorias.map((c) => (
                <li key={c.id ?? c.nome} className="flex flex-col gap-1">
                  <span className="flex justify-between gap-3">
                    <span>{c.nome}</span>
                    <span className="font-semibold tabular-nums">{formatarCentavos(c.totalCentavos)}</span>
                  </span>
                  <div className="h-2 rounded-full bg-suave" aria-hidden>
                    <div
                      className="h-full rounded-full bg-area"
                      style={{ width: `${Math.round((c.totalCentavos / maiorCategoria) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
  
        {r.meses.length > 1 && (
          <section
            aria-labelledby="titulo-evolucao"
            className="superficie flex flex-col gap-3 p-4"
          >
            <h2 id="titulo-evolucao" className="text-secao font-bold">
              Mês a mês
            </h2>
            {/* Barras horizontais: cabem no celular e cada linha diz o valor por escrito. */}
            <ul className="flex flex-col gap-2.5">
              {r.meses.map((m) => (
                <li key={m.mes} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
                  <span className="text-base text-muted-foreground first-letter:uppercase">{nomeCurtoDoMes(m.mes)}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-suave" aria-hidden>
                    <div
                      className="flex h-full rounded-full bg-area/35"
                      style={{ width: `${Math.round((m.totalCentavos / maiorMes) * 100)}%` }}
                    >
                      <div
                        className="h-full rounded-full bg-area"
                        style={{ width: m.totalCentavos ? `${Math.round((m.pagoCentavos / m.totalCentavos) * 100)}%` : 0 }}
                      />
                    </div>
                  </div>
                  <span className="text-base font-semibold tabular-nums">{formatarCentavos(m.totalCentavos)}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">Parte escura da barra: já pago.</p>
          </section>
        )}
      </div>
    </div>
  )
}

// Mesmas regras de src/modules/imoveis/schema.js.
const esquema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do imóvel.').max(100, 'Nome longo demais.'),
  endereco: z.string().max(300, 'Use no máximo 300 caracteres.'),
  complemento: z.string().max(100, 'Use no máximo 100 caracteres.'),
})
type Dados = z.infer<typeof esquema>

/** Nome, endereço e identificação complementar (ex.: "Apto 302"); só o nome é obrigatório. */
function DadosImovel({ imovel }: { imovel: Imovel }) {
  const salvar = useSalvarImovel()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: { nome: imovel.nome, endereco: imovel.endereco ?? '', complemento: imovel.complemento ?? '' },
  })

  async function enviar(d: Dados) {
    try {
      const salvo = await salvar.mutateAsync({
        id: imovel.id,
        nome: d.nome.trim(),
        endereco: d.endereco.trim() || null,
        complemento: d.complemento.trim() || null,
      })
      toast.success('Imóvel salvo.')
      reset({ nome: salvo.nome, endereco: salvo.endereco ?? '', complemento: salvo.complemento ?? '' })
    } catch (erro) {
      aplicarErroApi(erro, setError, { porCodigo: { IMOVEL_DUPLICADO: 'nome' } })
    }
  }

  return (
    <section
      aria-labelledby="titulo-dados-imovel"
      className="superficie flex flex-col gap-4 p-4 md:max-w-2xl md:p-5"
    >
      <h2 id="titulo-dados-imovel" className="text-secao font-bold">
        Dados do imóvel
      </h2>
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-5">
        <Campo rotulo="Nome" erro={errors.nome?.message} {...register('nome')} />
        <Campo
          rotulo="Endereço (opcional)"
          placeholder="Ex.: Rua das Acácias, 450"
          erro={errors.endereco?.message}
          {...register('endereco')}
        />
        <Campo
          rotulo="Identificação (opcional)"
          placeholder="Ex.: Apto 1201, matrícula, código do IPTU"
          erro={errors.complemento?.message}
          {...register('complemento')}
        />
        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" disabled={!isDirty || isSubmitting} className="w-full sm:w-auto sm:self-start">
          {isSubmitting ? 'Salvando…' : 'Salvar dados'}
        </Button>
      </form>
    </section>
  )
}
