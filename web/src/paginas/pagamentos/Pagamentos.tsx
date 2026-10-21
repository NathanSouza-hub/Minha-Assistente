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
import type { CategoriaPagamento, Imovel } from '@/lib/tipos'
import { AbaCartoes } from '@/paginas/cartoes/AbaCartoes'
import { FormCategoria } from '@/paginas/categorias/FormCategoria'
import { AbaEquipe } from '@/paginas/equipe/AbaEquipe'
import { NavegadorMes, ResumoContas } from './ResumoContas'
import { type FiltroStatus, useFiltros } from './filtros'
import { ProximasContas } from './ProximasContas'
import { TabelaContas } from './TabelaContas'

/** Valores de ?aba= dos grupos fixos (os outros grupos são ids de categoria). */
const ABA_EQUIPE = 'equipe'
const ABA_CARTOES = 'cartoes'

/** "Contas residenciais" (ou "residências"...): a categoria das contas de casa, pelo nome. */
const ehResidencial = (nome: string) => chaveCategoria(nome).includes('residen')

type Filtros = ReturnType<typeof useFiltros>

/** Trocar de grupo: Cartões abre na fatura atual (não no mês da lista) e o imóvel vale só para o grupo
 * em que foi escolhido. */
const mudarGrupo = (mudar: Filtros['mudar'], grupo: string) =>
  mudar(grupo === ABA_CARTOES ? { aba: grupo, mes: '', imovel: '', cartao: '' } : { aba: grupo, imovel: '' })

/**
 * "Grupo de contas e imóvel" recolhido, no modelo do filtro da Lista de despesas: o grupo (uma
 * categoria do usuário, "Salários equipe" ou "Cartões"; não há "Todos" — ver tudo junto é na Lista de
 * despesas), o imóvel e "Nova categoria". Recolhido, mostra o que está escolhido.
 */
function PainelFiltros({
  categorias,
  grupo,
  imoveis = [],
  imovelId = '',
  mudar,
}: {
  categorias: CategoriaPagamento[]
  grupo: string
  /** Só no grupo de categoria (equipe e cartões não têm imóvel). */
  imoveis?: Imovel[]
  imovelId?: string
  mudar: Filtros['mudar']
}) {
  const [criando, setCriando] = useState(false)
  const grupos = [...categorias, { id: ABA_EQUIPE, nome: 'Salários equipe' }, { id: ABA_CARTOES, nome: 'Cartões' }]
  const escolhido = [grupos.find((g) => g.id === grupo)?.nome, imoveis.find((i) => i.id === imovelId)?.nome]
    .filter(Boolean)
    .join(' · ')

  return (
    <details className="group rounded-2xl bg-folha shadow-folha" open={criando || Boolean(imovelId) || undefined}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
        <SlidersHorizontalIcon className="size-5 shrink-0 text-area" weight="bold" aria-hidden />
        <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-3">
          Grupo de contas e imóvel
          {escolhido && <span className="truncate text-base font-normal text-muted-foreground">{escolhido}</span>}
        </span>
        {imovelId && <span className="rounded-full bg-area px-2 text-sm text-folha">1</span>}
        <CaretRightIcon className="ml-auto size-5 shrink-0 transition-transform group-open:rotate-90" weight="bold" aria-hidden />
      </summary>
      <div className="flex flex-col gap-4 border-t border-linha p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao rotulo="Grupo de contas" value={grupo} onChange={(e) => mudarGrupo(mudar, e.target.value)}>
            {grupo === '' && <option value="">Escolha</option>}
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Selecao>
          {imoveis.length > 0 && (
            <Selecao rotulo="Imóvel" value={imovelId} onChange={(e) => mudar({ imovel: e.target.value })}>
              <option value="">Todos</option>
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </Selecao>
          )}
        </div>
        {criando ? (
          <FormCategoria
            autoFocus
            aoSalvar={(nova) => {
              setCriando(false)
              mudarGrupo(mudar, nova.id)
            }}
            aoCancelar={() => setCriando(false)}
          />
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setCriando(true)}>
            <PlusIcon weight="bold" aria-hidden />
            Nova categoria
          </Button>
        )}
      </div>
    </details>
  )
}

export function Pagamentos() {
  const filtros = useFiltros()
  const { data: categorias = [] } = useCategorias()

  if (filtros.aba === ABA_EQUIPE || filtros.aba === ABA_CARTOES) {
    return (
      <Pagina titulo="Cadastro de despesas">
        <div className="flex flex-col gap-5">
          <PainelFiltros categorias={categorias} grupo={filtros.aba} mudar={filtros.mudar} />
          {filtros.aba === ABA_EQUIPE ? (
            <AbaEquipe mes={filtros.mes} aoMudarMes={(mes) => filtros.mudar({ mes })} />
          ) : (
            <AbaCartoes />
          )}
        </div>
      </Pagina>
    )
  }
  return <ListaDeContas filtros={filtros} />
}

function ListaDeContas({ filtros }: { filtros: Filtros }) {
  const { data: categorias, isPending, isError, refetch } = useCategorias()
  if (isPending) {
    return (
      <Pagina titulo="Cadastro de despesas" larga>
        <Skeleton className="h-36" role="status" aria-label="Carregando categorias" />
      </Pagina>
    )
  }
  if (isError) {
    return (
      <Pagina titulo="Cadastro de despesas" larga>
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
      <Pagina titulo="Cadastro de despesas" larga>
        <div className="flex flex-col gap-5">
          <PainelFiltros categorias={categorias} grupo="" mudar={filtros.mudar} />
          <EstadoVazio icone={WalletIcon} titulo="Nenhuma categoria">
            Crie uma categoria em "Nova categoria" para cadastrar as contas.
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
  filtros: Filtros
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
  const imovelAtivo = imoveis.find((i) => i.id === imovelId)

  const temFiltro = status !== 'todos' || Boolean(imovelId)
  // Nas contas residenciais, a conta nova já vem com o imóvel escolhido.
  const novo = `/pagamentos/novo?mes=${mes}&aba=${categoriaId}${
    ehResidencial(categoriaAtiva.nome) && imovelAtivo ? `&imovel=${imovelAtivo.id}` : ''
  }`
  const ondeEstou = ` de ${categoriaAtiva.nome.toLowerCase()}${imovelAtivo ? ` (${imovelAtivo.nome})` : ''}`

  return (
    <Pagina
      titulo="Cadastro de despesas"
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

        <PainelFiltros
          categorias={categorias}
          grupo={categoriaId}
          imoveis={imoveis}
          imovelId={imovelId}
          mudar={mudar}
        />

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
          // Sem `voltar`: a conta aberta daqui volta para este grupo ao salvar ou excluir.
          <TabelaContas pagamentos={pagamentos} rotulo={`Contas${ondeEstou} do mês`} voltar="" />
        )}

        <ProximasContas />
      </div>
    </Pagina>
  )
}
