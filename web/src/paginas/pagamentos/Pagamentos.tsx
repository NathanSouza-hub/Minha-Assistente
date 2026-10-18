import { useState } from 'react'
import { CaretRightIcon, PlusIcon, SlidersHorizontalIcon, WalletIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategorias, useImoveis, usePagamentos } from '@/consultas/pagamentos'
import { chaveCategoria } from '@/lib/compras'
import { intervaloDoMes, nomeDoMes } from '@/lib/datas'
import type { CategoriaPagamento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { AbaCartoes } from '@/paginas/cartoes/AbaCartoes'
import { FormCategoria } from '@/paginas/categorias/FormCategoria'
import { AbaEquipe } from '@/paginas/equipe/AbaEquipe'
import { NavegadorMes, ResumoContas } from './ResumoContas'
import { type FiltroStatus, useFiltros } from './filtros'
import { ItemPagamento } from './ItemPagamento'

/** Valores de ?aba= das abas fixas (as outras abas são ids de categoria). */
const ABA_EQUIPE = 'equipe'
const ABA_CARTOES = 'cartoes'

/** "Contas residenciais" (ou "residências"...): a categoria das contas de casa, pelo nome. */
const ehResidencial = (nome: string) => chaveCategoria(nome).includes('residen')

/** Uma aba por categoria, "Salários equipe", "Cartões" e o botão de criar categoria. Rola para o lado no celular.
 * Ver tudo junto é na Lista de despesas (ListaDespesas.tsx). */
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
  const abas = [
    ...categorias,
    { id: ABA_EQUIPE, nome: 'Salários equipe' },
    { id: ABA_CARTOES, nome: 'Cartões' },
  ]

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
                'min-h-11 rounded-full px-4 font-semibold whitespace-nowrap',
                ativa === aba.id ? 'bg-area text-folha' : 'bg-areia hover:bg-linha',
              )}
            >
              {aba.nome}
            </button>
          ))}
          <button
            type="button"
            aria-expanded={criando}
            onClick={() => setCriando((v) => !v)}
            className="flex min-h-11 items-center gap-1 rounded-full border-2 border-dashed border-input px-4 font-semibold whitespace-nowrap text-area hover:bg-areia"
          >
            <PlusIcon className="size-5" weight="bold" aria-hidden />
            Nova
          </button>
        </div>
      </div>
      {criando && (
        <div className="rounded-2xl bg-folha p-4 shadow-folha">
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

  if (filtros.aba === ABA_EQUIPE) {
    return (
      <Pagina titulo="Cadastro de despesas">
        <div className="flex flex-col gap-5">
          <Abas
            categorias={categorias}
            ativa={ABA_EQUIPE}
            aoMudar={(nova) => filtros.mudar(nova === ABA_CARTOES ? { aba: nova, mes: '' } : { aba: nova })}
          />
          <AbaEquipe mes={filtros.mes} aoMudarMes={(mes) => filtros.mudar({ mes })} />
        </div>
      </Pagina>
    )
  }
  if (filtros.aba === ABA_CARTOES) {
    return (
      <Pagina titulo="Cadastro de despesas">
        <div className="flex flex-col gap-5">
          <Abas categorias={categorias} ativa={ABA_CARTOES} aoMudar={(nova) => filtros.mudar({ aba: nova, mes: '', cartao: '' })} />
          <AbaCartoes />
        </div>
      </Pagina>
    )
  }
  return <ListaDeContas filtros={filtros} />
}

function ListaDeContas({ filtros }: { filtros: ReturnType<typeof useFiltros> }) {
  const { data: categorias, isPending, isError, refetch } = useCategorias()
  if (isPending) {
    return (
      <Pagina titulo="Cadastro de despesas">
        <Skeleton className="h-36" role="status" aria-label="Carregando categorias" />
      </Pagina>
    )
  }
  if (isError) {
    return (
      <Pagina titulo="Cadastro de despesas">
        <EstadoVazio
          icone={WalletIcon}
          titulo="Não foi possível carregar as categorias"
          acao={<Button onClick={() => refetch()}>Tentar de novo</Button>}
        >
          Verifique a internet e tente de novo.
        </EstadoVazio>
      </Pagina>
    )
  }
  // Sem aba (ou aba de categoria apagada, link antigo): abre na primeira categoria.
  const categoriaAtiva = categorias.find((c) => c.id === filtros.aba) ?? categorias[0]
  if (!categoriaAtiva) {
    return (
      <Pagina titulo="Cadastro de despesas">
        <div className="flex flex-col gap-5">
          <Abas categorias={categorias} ativa="" aoMudar={(nova) => filtros.mudar({ aba: nova })} />
          <EstadoVazio icone={WalletIcon} titulo="Nenhuma categoria">
            Crie uma categoria em "+ Nova" para cadastrar as contas.
          </EstadoVazio>
        </div>
      </Pagina>
    )
  }
  return <ContasDaCategoria filtros={filtros} categorias={categorias} categoriaAtiva={categoriaAtiva} />
}

function ContasDaCategoria({
  filtros: { mes, status, imovelId, mudar },
  categorias,
  categoriaAtiva,
}: {
  filtros: ReturnType<typeof useFiltros>
  categorias: CategoriaPagamento[]
  categoriaAtiva: CategoriaPagamento
}) {
  const { data: imoveis = [] } = useImoveis()
  const categoriaId = categoriaAtiva.id
  const consulta = usePagamentos({
    ...intervaloDoMes(mes),
    status: status === 'todos' ? undefined : status,
    categoriaId,
    imovelId: imovelId || undefined,
  })
  const pagamentos = consulta.data ?? []
  // Na aba de contas residenciais os imóveis viram sub-abas (no resto, um filtro recolhido).
  const imoveisEmAbas = ehResidencial(categoriaAtiva.nome) && imoveis.length > 0
  const imovelAtivo = imoveis.find((i) => i.id === imovelId)

  const temFiltro = status !== 'todos' || (Boolean(imovelId) && !imoveisEmAbas)
  const novo = `/pagamentos/novo?mes=${mes}&aba=${categoriaId}${
    imoveisEmAbas && imovelAtivo ? `&imovel=${imovelAtivo.id}` : ''
  }`
  const ondeEstou = ` de ${categoriaAtiva.nome.toLowerCase()}${imoveisEmAbas && imovelAtivo ? ` (${imovelAtivo.nome})` : ''}`

  return (
    <Pagina
      titulo="Cadastro de despesas"
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
                    'min-h-11 rounded-lg border-2 px-3 font-semibold whitespace-nowrap',
                    imovelId === i.id ? 'border-area bg-area-fundo text-area' : 'border-transparent bg-areia hover:bg-linha',
                  )}
                >
                  {i.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <NavegadorMes mes={mes} aoMudar={(novo) => mudar({ mes: novo })} />

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
          <details className="group rounded-2xl bg-folha shadow-folha" open={Boolean(imovelId) || undefined}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
              <SlidersHorizontalIcon className="size-5 text-area" weight="bold" aria-hidden />
              Imóvel
              {imovelId && <span className="rounded-full bg-area px-2 text-sm text-folha">1</span>}
              <CaretRightIcon className="ml-auto size-5 transition-transform group-open:rotate-90" weight="bold" aria-hidden />
            </summary>
            <div className="border-t border-linha p-4">
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

        {pagamentos.length > 0 && <ResumoContas pagamentos={pagamentos} />}

        {consulta.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Carregando contas">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-16" />
            ))}
          </div>
        ) : consulta.isError ? (
          <EstadoVazio
            icone={WalletIcon}
            titulo="Não foi possível carregar as contas"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          >
            Verifique a internet e tente de novo.
          </EstadoVazio>
        ) : pagamentos.length === 0 ? (
          temFiltro ? (
            <EstadoVazio
              icone={WalletIcon}
              titulo="Nenhuma conta com esses filtros"
              acao={
                <Button variant="outline" onClick={() => mudar({ status: '', imovel: '' })}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EstadoVazio
              icone={WalletIcon}
              titulo={`Nenhuma conta${ondeEstou} em ${nomeDoMes(mes).toLowerCase()}`}
              acao={
                <Button asChild>
                  <Link to={novo}>Adicionar conta</Link>
                </Button>
              }
            />
          )
        ) : (
          <ul className="flex flex-col divide-y divide-linha" aria-label={`Contas${ondeEstou} do mês`}>
            {pagamentos.map((p) => (
              <ItemPagamento key={p.id} pagamento={p} />
            ))}
          </ul>
        )}
      </div>
    </Pagina>
  )
}
