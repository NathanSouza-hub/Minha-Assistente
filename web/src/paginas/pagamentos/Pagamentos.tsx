import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, Wallet } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategorias, useImoveis, usePagamentos } from '@/consultas/pagamentos'
import { chaveCategoria } from '@/lib/compras'
import { intervaloDoMes, mesDe, nomeDoMes, somarMeses } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { CategoriaPagamento, StatusPagamento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { AbaCartoes } from '@/paginas/cartoes/AbaCartoes'
import { FormCategoria } from '@/paginas/categorias/FormCategoria'
import { ItemPagamento } from './ItemPagamento'

type FiltroStatus = 'todos' | StatusPagamento

/** Valor de ?aba= da aba Cartões (as outras abas são ids de categoria). */
const ABA_CARTOES = 'cartoes'

/** "Contas residenciais" (ou "residências"...): a categoria das contas de casa, pelo nome. */
const ehResidencial = (nome: string) => chaveCategoria(nome).includes('residen')

/** Mês, aba e filtros moram na URL: recarregar ou voltar mantém o que a pessoa escolheu. */
function useFiltros() {
  const [params, setParams] = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesDe()
  const status = (params.get('status') as FiltroStatus | null) ?? 'todos'
  const aba = params.get('aba') ?? ''
  const imovelId = params.get('imovel') ?? ''

  const mudar = (mudancas: Record<string, string>) =>
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual)
        for (const [chave, valor] of Object.entries(mudancas)) {
          if (valor && valor !== 'todos') novo.set(chave, valor)
          else novo.delete(chave)
        }
        return novo
      },
      { replace: true },
    )

  return { mes, status, aba, imovelId, mudar }
}

/** "Todas", uma aba por categoria, "Cartões" e o botão de criar categoria. Rola para o lado no celular. */
function Abas({
  categorias,
  ativa,
  aoMudar,
}: {
  categorias: CategoriaPagamento[]
  ativa: string
  aoMudar: (aba: string) => void
}) {
  const [criando, setCriando] = useState(false)
  const abas = [{ id: '', nome: 'Todas' }, ...categorias, { id: ABA_CARTOES, nome: 'Cartões' }]

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 overflow-x-auto px-4 pb-1 md:-mx-8 md:px-8">
        <div role="group" aria-label="Categorias" className="flex w-max gap-2">
          {abas.map((aba) => (
            <button
              key={aba.id}
              type="button"
              aria-pressed={ativa === aba.id}
              onClick={() => aoMudar(aba.id)}
              className={cn(
                'min-h-11 rounded-full border px-4 font-semibold whitespace-nowrap',
                ativa === aba.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
              )}
            >
              {aba.nome}
            </button>
          ))}
          <button
            type="button"
            aria-expanded={criando}
            onClick={() => setCriando((v) => !v)}
            className="flex min-h-11 items-center gap-1 rounded-full border border-dashed px-4 font-semibold whitespace-nowrap text-primary hover:bg-muted"
          >
            <Plus className="size-5" aria-hidden />
            Nova
          </button>
        </div>
      </div>
      {criando && (
        <div className="rounded-xl border bg-card p-4">
          <FormCategoria
            autoFocus
            aoSalvar={(nova) => {
              setCriando(false)
              aoMudar(nova.id)
            }}
            aoCancelar={() => setCriando(false)}
          />
        </div>
      )}
    </div>
  )
}

export function Pagamentos() {
  const filtros = useFiltros()
  const { data: categorias = [] } = useCategorias()

  if (filtros.aba === ABA_CARTOES) {
    return (
      <Pagina titulo="Contas">
        <div className="flex flex-col gap-5">
          <Abas categorias={categorias} ativa={ABA_CARTOES} aoMudar={(nova) => filtros.mudar({ aba: nova, mes: '', cartao: '' })} />
          <AbaCartoes />
        </div>
      </Pagina>
    )
  }
  return <ListaDeContas filtros={filtros} categorias={categorias} />
}

function ListaDeContas({
  filtros: { mes, status, aba, imovelId, mudar },
  categorias,
}: {
  filtros: ReturnType<typeof useFiltros>
  categorias: CategoriaPagamento[]
}) {
  const { data: imoveis = [] } = useImoveis()
  // Aba de categoria que não existe mais (apagada, link antigo) vira "Todas".
  const categoriaAtiva = categorias.find((c) => c.id === aba)
  const categoriaId = categoriaAtiva?.id ?? ''
  const consulta = usePagamentos({
    ...intervaloDoMes(mes),
    status: status === 'todos' ? undefined : status,
    categoriaId: categoriaId || undefined,
    imovelId: imovelId || undefined,
  })
  const pagamentos = consulta.data ?? []
  // Na aba de contas residenciais os imóveis viram sub-abas (no resto, um filtro recolhido).
  const imoveisEmAbas = Boolean(categoriaAtiva && ehResidencial(categoriaAtiva.nome) && imoveis.length > 0)
  const imovelAtivo = imoveis.find((i) => i.id === imovelId)

  const aPagar = pagamentos.filter((p) => p.status === 'pendente')
  const vencidos = aPagar.filter((p) => p.vencido).length
  const soma = (lista: typeof pagamentos) => lista.reduce((total, p) => total + p.valorCentavos, 0)
  const temFiltro = status !== 'todos' || (Boolean(imovelId) && !imoveisEmAbas)
  const novo = `/pagamentos/novo?mes=${mes}${categoriaId ? `&aba=${categoriaId}` : ''}${
    imoveisEmAbas && imovelAtivo ? `&imovel=${imovelAtivo.id}` : ''
  }`
  const ondeEstou = categoriaAtiva
    ? ` de ${categoriaAtiva.nome.toLowerCase()}${imoveisEmAbas && imovelAtivo ? ` (${imovelAtivo.nome})` : ''}`
    : ''

  return (
    <Pagina
      titulo="Contas"
      acoes={
        <Button asChild size="lg">
          <Link to={novo}>
            <Plus aria-hidden />
            Nova
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Abas
          categorias={categorias}
          ativa={categoriaId}
          // A aba Cartões abre na fatura atual, não no mês que estava na lista. O imóvel escolhido
          // vale só para a aba em que foi escolhido.
          aoMudar={(nova) => mudar(nova === ABA_CARTOES ? { aba: nova, mes: '', imovel: '' } : { aba: nova, imovel: '' })}
        />

        {imoveisEmAbas && (
          <div className="-mx-4 overflow-x-auto px-4 pb-1 md:-mx-8 md:px-8">
            <div role="group" aria-label="Imóveis" className="flex w-max gap-2">
              {[{ id: '', nome: 'Todos os imóveis' }, ...imoveis].map((i) => (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={imovelId === i.id}
                  onClick={() => mudar({ imovel: i.id })}
                  className={cn(
                    'min-h-11 rounded-lg border px-3 font-semibold whitespace-nowrap',
                    imovelId === i.id ? 'border-primary bg-secondary text-secondary-foreground' : 'bg-card hover:bg-muted',
                  )}
                >
                  {i.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <nav aria-label="Mês" className="flex items-center justify-between gap-2 rounded-xl border bg-card p-1">
          <Button variant="ghost" size="icon" onClick={() => mudar({ mes: somarMeses(mes, -1) })} aria-label="Mês anterior">
            <ChevronLeft className="size-7" aria-hidden />
          </Button>
          <h2 className="text-xl font-bold" aria-live="polite">
            {nomeDoMes(mes)}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => mudar({ mes: somarMeses(mes, 1) })} aria-label="Próximo mês">
            <ChevronRight className="size-7" aria-hidden />
          </Button>
        </nav>

        <Opcoes<FiltroStatus>
          rotulo="Mostrar"
          rotuloOculto
          formato="segmentos"
          valor={status}
          aoMudar={(valor) => mudar({ status: valor })}
          opcoes={[
            { valor: 'todos', rotulo: 'Todos' },
            { valor: 'pendente', rotulo: 'A pagar' },
            { valor: 'pago', rotulo: 'Pagos' },
          ]}
        />

        {imoveis.length > 0 && !imoveisEmAbas && (
          <details className="group rounded-xl border bg-card" open={Boolean(imovelId) || undefined}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="size-5 text-primary" aria-hidden />
              Imóvel
              {imovelId && <span className="rounded-full bg-primary px-2 text-sm text-primary-foreground">1</span>}
              <ChevronRight className="ml-auto size-5 transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <div className="border-t p-4">
              <Selecao rotulo="Imóvel" value={imovelId} onChange={(e) => mudar({ imovel: e.target.value })}>
                <option value="">Todos</option>
                {imoveis.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </Selecao>
            </div>
          </details>
        )}

        {pagamentos.length > 0 && (
          <dl className="grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-xl border bg-card p-4">
              <dt className="text-base text-muted-foreground">A pagar</dt>
              <dd className="text-xl font-bold tabular-nums sm:text-2xl">{formatarCentavos(soma(aPagar))}</dd>
              {vencidos > 0 && (
                <dd className="font-semibold text-atraso">
                  {vencidos === 1 ? '1 conta vencida' : `${vencidos} contas vencidas`}
                </dd>
              )}
            </div>
            <div className="min-w-0 rounded-xl border bg-card p-4">
              <dt className="text-base text-muted-foreground">Pago</dt>
              <dd className="text-xl font-bold tabular-nums sm:text-2xl">
                {formatarCentavos(soma(pagamentos.filter((p) => p.status === 'pago')))}
              </dd>
            </div>
          </dl>
        )}

        {consulta.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Carregando contas">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : consulta.isError ? (
          <EstadoVazio
            icone={Wallet}
            titulo="Não foi possível carregar as contas"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          >
            Verifique a internet e tente de novo.
          </EstadoVazio>
        ) : pagamentos.length === 0 ? (
          temFiltro ? (
            <EstadoVazio
              icone={Wallet}
              titulo="Nenhuma conta com esses filtros"
              acao={
                <Button variant="outline" onClick={() => mudar({ status: '', imovel: '' })}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EstadoVazio
              icone={Wallet}
              titulo={`Nenhuma conta${ondeEstou} em ${nomeDoMes(mes).toLowerCase()}`}
              acao={
                <Button asChild>
                  <Link to={novo}>Adicionar conta</Link>
                </Button>
              }
            />
          )
        ) : (
          <ul className="flex flex-col gap-3" aria-label={`Contas${ondeEstou} do mês`}>
            {pagamentos.map((p) => (
              <ItemPagamento key={p.id} pagamento={p} />
            ))}
          </ul>
        )}
      </div>
    </Pagina>
  )
}
