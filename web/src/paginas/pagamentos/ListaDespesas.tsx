import { CaretRightIcon, PlusIcon, SlidersHorizontalIcon, WalletIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategorias, useImoveis, usePagamentos } from '@/consultas/pagamentos'
import { intervaloDoMes, nomeDoMes } from '@/lib/datas'
import { type FiltroStatus, IMOVEL_PESSOAL, useFiltros, VOLTAR_DESPESAS } from './filtros'
import { NavegadorMes, ResumoContas } from './ResumoContas'
import { ResumoPessoais } from './ResumoPessoais'
import { TabelaContas } from './TabelaContas'

/** /despesas: tudo do mês numa tabela (contas, faturas dos cartões e equipe) para ver e pagar.
 * Cadastrar por categoria, equipe e cartões é no Cadastro de despesas (/pagamentos). */
export function ListaDespesas() {
  const { mes, status, categoriaId, imovelId, mudar } = useFiltros()
  const { data: categorias = [] } = useCategorias()
  const { data: imoveis = [] } = useImoveis()
  const consulta = usePagamentos({
    ...intervaloDoMes(mes),
    status: status === 'todos' ? undefined : status,
    categoriaId: categoriaId || undefined,
    // `?imovel=pessoal` (vem do painel): só as despesas sem imóvel.
    ...(imovelId === IMOVEL_PESSOAL ? { destino: 'pessoal' as const } : { imovelId: imovelId || undefined }),
  })
  const pagamentos = consulta.data ?? []
  const filtrosAbertos = Number(Boolean(categoriaId)) + Number(Boolean(imovelId))
  const temFiltro = status !== 'todos' || filtrosAbertos > 0
  const novo = `/pagamentos/novo?mes=${mes}&voltar=${VOLTAR_DESPESAS}`
  // "Pessoais" no menu: a mesma lista, com o resumo por categoria em cima.
  const pessoais = imovelId === IMOVEL_PESSOAL

  return (
    <Pagina
      titulo={pessoais ? 'Despesas pessoais' : 'Lista de despesas'}
      larga
      acoes={
        <Button asChild size="lg">
          <Link to={novo}>
            <PlusIcon weight="bold" aria-hidden />
            Nova
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <NavegadorMes mes={mes} aoMudar={(novoMes) => mudar({ mes: novoMes })} />

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

        <details className="group rounded-2xl bg-folha shadow-folha" open={filtrosAbertos > 0 || undefined}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            <SlidersHorizontalIcon className="size-5 text-area" weight="bold" aria-hidden />
            Categoria e imóvel
            {filtrosAbertos > 0 && (
              <span className="rounded-full bg-area px-2 text-sm text-folha">{filtrosAbertos}</span>
            )}
            <CaretRightIcon className="ml-auto size-5 transition-transform group-open:rotate-90" weight="bold" aria-hidden />
          </summary>
          <div className="grid gap-4 border-t border-linha p-4 sm:grid-cols-2">
            <Selecao rotulo="Categoria" value={categoriaId} onChange={(e) => mudar({ categoria: e.target.value })}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
            {imoveis.length > 0 && (
              <Selecao rotulo="Imóvel" value={imovelId} onChange={(e) => mudar({ imovel: e.target.value })}>
                <option value="">Todos</option>
                <option value={IMOVEL_PESSOAL}>Despesas pessoais (sem imóvel)</option>
                {imoveis.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </div>
        </details>

        {pessoais && <ResumoPessoais mes={mes} />}

        {pagamentos.length > 0 && <ResumoContas pagamentos={pagamentos} />}

        {consulta.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Carregando despesas">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-16" />
            ))}
          </div>
        ) : consulta.isError ? (
          <EstadoVazio
            icone={WalletIcon}
            titulo="Não foi possível carregar as despesas"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          >
            Verifique a internet e tente de novo.
          </EstadoVazio>
        ) : pagamentos.length === 0 ? (
          temFiltro ? (
            <EstadoVazio
              icone={WalletIcon}
              titulo="Nenhuma despesa com esses filtros"
              acao={
                <Button variant="outline" onClick={() => mudar({ status: '', categoria: '', imovel: '' })}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EstadoVazio
              icone={WalletIcon}
              titulo={`Nenhuma despesa em ${nomeDoMes(mes).toLowerCase()}`}
              acao={
                <Button asChild>
                  <Link to={novo}>Adicionar despesa</Link>
                </Button>
              }
            />
          )
        ) : (
          <TabelaContas pagamentos={pagamentos} rotulo="Despesas do mês" />
        )}
      </div>
    </Pagina>
  )
}
