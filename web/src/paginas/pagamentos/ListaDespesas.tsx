import type { ReactNode } from 'react'
import {
  CaretRightIcon,
  ChartBarIcon,
  ClockIcon,
  ListBulletsIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  WalletIcon,
} from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Abas } from '@/components/Abas'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategorias, useImoveis, usePagamentos } from '@/consultas/pagamentos'
import { intervaloDoMes, nomeDoMes } from '@/lib/datas'
import type { CategoriaPagamento, Pagamento } from '@/lib/tipos'
import { type FiltroStatus, IMOVEL_PESSOAL, useFiltros, VOLTAR_DESPESAS } from './filtros'
import { NavegadorMes, ResumoContas } from './ResumoContas'
import { ResumoPessoais } from './ResumoPessoais'
import { TabelaContas } from './TabelaContas'

type Mudar = ReturnType<typeof useFiltros>['mudar']

/** /despesas: tudo do mês numa tabela (contas, faturas dos cartões e equipe) para ver e pagar.
 * Cadastrar por categoria, equipe e cartões é no Cadastro de despesas (/pagamentos).
 * Com `?imovel=pessoal` (o "Pessoais" do menu) vira a tela Despesas pessoais, em abas. */
export function ListaDespesas() {
  const filtros = useFiltros()
  if (filtros.imovelId === IMOVEL_PESSOAL)
    return <DespesasPessoais mes={filtros.mes} categoriaId={filtros.categoriaId} mudar={filtros.mudar} />
  return <TodasAsDespesas filtros={filtros} />
}

function TodasAsDespesas({ filtros: { mes, status, categoriaId, imovelId, mudar } }: { filtros: ReturnType<typeof useFiltros> }) {
  const { data: categorias = [] } = useCategorias()
  const { data: imoveis = [] } = useImoveis()
  const consulta = usePagamentos({
    ...intervaloDoMes(mes),
    status: status === 'todos' ? undefined : status,
    categoriaId: categoriaId || undefined,
    imovelId: imovelId || undefined,
  })
  const pagamentos = consulta.data ?? []
  const filtrosAbertos = Number(Boolean(categoriaId)) + Number(Boolean(imovelId))
  const temFiltro = status !== 'todos' || filtrosAbertos > 0
  const novo = `/pagamentos/novo?mes=${mes}&voltar=${VOLTAR_DESPESAS}`

  return (
    <Pagina titulo="Lista de despesas" larga acoes={<BotaoNova para={novo} />}>
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

        <PainelFiltros titulo="Categoria e imóvel" emUso={filtrosAbertos}>
          <SelecaoCategoria categorias={categorias} valor={categoriaId} mudar={mudar} />
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
        </PainelFiltros>

        {pagamentos.length > 0 && <ResumoContas pagamentos={pagamentos} />}

        <ConteudoLista
          consulta={consulta}
          pagamentos={pagamentos}
          rotulo="Despesas do mês"
          vazio={
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
              <SemDespesas mes={mes} novo={novo} />
            )
          }
        />
      </div>
    </Pagina>
  )
}

type AbaPessoais = 'despesas' | 'a-pagar' | 'categorias'

/**
 * Despesas pessoais (sem imóvel) em abas: as do mês, as que faltam pagar e o total por categoria.
 * Sem o filtro de imóvel (a tela já é das pessoais) nem Todos/A pagar/Pagos (as abas fazem esse
 * papel); a categoria continua.
 */
function DespesasPessoais({ mes, categoriaId, mudar }: { mes: string; categoriaId: string; mudar: Mudar }) {
  const { data: categorias = [] } = useCategorias()
  // Uma busca do mês: "A pagar" é a mesma lista filtrada pelo status que vem da API.
  const consulta = usePagamentos({ ...intervaloDoMes(mes), categoriaId: categoriaId || undefined, destino: 'pessoal' })
  const pagamentos = consulta.data ?? []
  const pendentes = pagamentos.filter((p) => p.status === 'pendente')
  const novo = `/pagamentos/novo?mes=${mes}&voltar=${VOLTAR_DESPESAS}`

  return (
    <Pagina titulo="Despesas pessoais" larga acoes={<BotaoNova para={novo} />}>
      <div className="flex flex-col gap-5">
        <NavegadorMes mes={mes} aoMudar={(novoMes) => mudar({ mes: novoMes })} />
        {pagamentos.length > 0 && <ResumoContas pagamentos={pagamentos} />}
        <Abas<AbaPessoais>
          rotulo="Partes de Despesas pessoais"
          abas={[
            {
              valor: 'despesas',
              rotulo: 'Despesas do mês',
              icone: ListBulletsIcon,
              conteudo: (
                <div className="flex flex-col gap-5">
                  <PainelFiltros titulo="Categoria" emUso={Number(Boolean(categoriaId))}>
                    <SelecaoCategoria categorias={categorias} valor={categoriaId} mudar={mudar} />
                  </PainelFiltros>
                  <ConteudoLista
                    consulta={consulta}
                    pagamentos={pagamentos}
                    rotulo="Despesas pessoais do mês"
                    vazio={
                      categoriaId ? (
                        <EstadoVazio
                          icone={WalletIcon}
                          titulo="Nenhuma despesa nesta categoria"
                          acao={
                            <Button variant="outline" onClick={() => mudar({ categoria: '' })}>
                              Limpar filtro
                            </Button>
                          }
                        />
                      ) : (
                        <SemDespesas mes={mes} novo={novo} texto="Nenhuma despesa pessoal" />
                      )
                    }
                  />
                </div>
              ),
            },
            {
              valor: 'a-pagar',
              rotulo: 'A pagar',
              icone: ClockIcon,
              contador: pendentes.length,
              conteudo: (
                <ConteudoLista
                  consulta={consulta}
                  pagamentos={pendentes}
                  rotulo="Despesas pessoais a pagar"
                  vazio={
                    <EstadoVazio icone={WalletIcon} titulo={`Nada a pagar em ${nomeDoMes(mes).toLowerCase()}`}>
                      {categoriaId ? 'Nada pendente nesta categoria.' : 'As despesas pessoais do mês estão pagas.'}
                    </EstadoVazio>
                  }
                />
              ),
            },
            {
              valor: 'categorias',
              rotulo: 'Por categoria',
              icone: ChartBarIcon,
              conteudo: <ResumoPessoais mes={mes} />,
            },
          ]}
        />
      </div>
    </Pagina>
  )
}

function BotaoNova({ para }: { para: string }) {
  return (
    <Button asChild size="lg">
      <Link to={para}>
        <PlusIcon weight="bold" aria-hidden />
        Nova
      </Link>
    </Button>
  )
}

/** Filtros recolhidos; recolhido mostra quantos estão em uso (e abre sozinho se algum estiver). */
function PainelFiltros({ titulo, emUso, children }: { titulo: string; emUso: number; children: ReactNode }) {
  return (
    <details className="group rounded-2xl bg-folha shadow-folha" open={emUso > 0 || undefined}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
        <SlidersHorizontalIcon className="size-5 text-area" weight="bold" aria-hidden />
        {titulo}
        {emUso > 0 && <span className="rounded-full bg-area px-2 text-sm text-folha">{emUso}</span>}
        <CaretRightIcon className="ml-auto size-5 transition-transform group-open:rotate-90" weight="bold" aria-hidden />
      </summary>
      <div className="grid gap-4 border-t border-linha p-4 sm:grid-cols-2">{children}</div>
    </details>
  )
}

function SelecaoCategoria({
  categorias,
  valor,
  mudar,
}: {
  categorias: CategoriaPagamento[]
  valor: string
  mudar: Mudar
}) {
  return (
    <Selecao rotulo="Categoria" value={valor} onChange={(e) => mudar({ categoria: e.target.value })}>
      <option value="">Todas</option>
      {categorias.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
        </option>
      ))}
    </Selecao>
  )
}

function SemDespesas({ mes, novo, texto = 'Nenhuma despesa' }: { mes: string; novo: string; texto?: string }) {
  return (
    <EstadoVazio
      icone={WalletIcon}
      titulo={`${texto} em ${nomeDoMes(mes).toLowerCase()}`}
      acao={
        <Button asChild>
          <Link to={novo}>Adicionar despesa</Link>
        </Button>
      }
    />
  )
}

/** Carregando, erro, vazio ou a tabela das despesas. */
function ConteudoLista({
  consulta,
  pagamentos,
  rotulo,
  vazio,
}: {
  consulta: { isPending: boolean; isError: boolean; refetch: () => unknown }
  pagamentos: Pagamento[]
  rotulo: string
  vazio: ReactNode
}) {
  if (consulta.isPending)
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Carregando despesas">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-16" />
        ))}
      </div>
    )
  if (consulta.isError)
    return (
      <EstadoVazio
        icone={WalletIcon}
        titulo="Não foi possível carregar as despesas"
        acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
      >
        Verifique a internet e tente de novo.
      </EstadoVazio>
    )
  if (pagamentos.length === 0) return vazio
  return <TabelaContas pagamentos={pagamentos} rotulo={rotulo} />
}
