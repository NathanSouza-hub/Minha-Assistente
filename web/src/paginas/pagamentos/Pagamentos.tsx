import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, Wallet } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategorias, useImoveis, usePagamentos } from '@/consultas/pagamentos'
import { intervaloDoMes, mesDe, nomeDoMes, somarMeses } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { StatusPagamento } from '@/lib/tipos'
import { ItemPagamento } from './ItemPagamento'

type FiltroStatus = 'todos' | StatusPagamento

/** Mês e filtros moram na URL: recarregar ou voltar mantém o que a pessoa escolheu. */
function useFiltros() {
  const [params, setParams] = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesDe()
  const status = (params.get('status') as FiltroStatus | null) ?? 'todos'
  const categoriaId = params.get('categoria') ?? ''
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

  return { mes, status, categoriaId, imovelId, mudar }
}

export function Pagamentos() {
  const { mes, status, categoriaId, imovelId, mudar } = useFiltros()
  const { data: categorias = [] } = useCategorias()
  const { data: imoveis = [] } = useImoveis()
  const consulta = usePagamentos({
    ...intervaloDoMes(mes),
    status: status === 'todos' ? undefined : status,
    categoriaId: categoriaId || undefined,
    imovelId: imovelId || undefined,
  })
  const pagamentos = consulta.data ?? []

  const aPagar = pagamentos.filter((p) => p.status === 'pendente')
  const vencidos = aPagar.filter((p) => p.vencido).length
  const soma = (lista: typeof pagamentos) => lista.reduce((total, p) => total + p.valorCentavos, 0)
  const filtrosExtras = [categoriaId, imovelId].filter(Boolean).length
  const temFiltro = status !== 'todos' || filtrosExtras > 0

  return (
    <Pagina
      titulo="Pagamentos"
      acoes={
        <Button asChild size="lg">
          <Link to={`/pagamentos/novo?mes=${mes}`}>
            <Plus aria-hidden />
            Novo
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
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

        <details className="group rounded-xl border bg-card" open={filtrosExtras > 0 || undefined}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="size-5 text-primary" aria-hidden />
            Categoria e imóvel
            {filtrosExtras > 0 && (
              <span className="rounded-full bg-primary px-2 text-sm text-primary-foreground">{filtrosExtras}</span>
            )}
            <ChevronRight className="ml-auto size-5 transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
            <Selecao rotulo="Categoria" value={categoriaId} onChange={(e) => mudar({ categoria: e.target.value })}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
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
          <div className="flex flex-col gap-3" role="status" aria-label="Carregando pagamentos">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : consulta.isError ? (
          <EstadoVazio
            icone={Wallet}
            titulo="Não foi possível carregar os pagamentos"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          >
            Verifique a internet e tente de novo.
          </EstadoVazio>
        ) : pagamentos.length === 0 ? (
          temFiltro ? (
            <EstadoVazio
              icone={Wallet}
              titulo="Nenhum pagamento com esses filtros"
              acao={
                <Button variant="outline" onClick={() => mudar({ status: '', categoria: '', imovel: '' })}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EstadoVazio
              icone={Wallet}
              titulo={`Nenhum pagamento em ${nomeDoMes(mes).toLowerCase()}`}
              acao={
                <Button asChild>
                  <Link to={`/pagamentos/novo?mes=${mes}`}>Adicionar pagamento</Link>
                </Button>
              }
            />
          )
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Pagamentos do mês">
            {pagamentos.map((p) => (
              <ItemPagamento key={p.id} pagamento={p} />
            ))}
          </ul>
        )}
      </div>
    </Pagina>
  )
}
