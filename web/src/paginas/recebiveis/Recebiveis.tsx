import type { ReactNode } from 'react'
import { HandCoinsIcon, PlusIcon, RepeatIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { Abas } from '@/components/Abas'
import { Bloco, Vazio } from '@/components/Bloco'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { SeloEstado } from '@/components/Estado'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRelatorioFinanceiro } from '@/consultas/pagamentos'
import { useRecebiveis } from '@/consultas/recebiveis'
import { dataCurta, intervaloDoMes, mesDe, nomeDoMes } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Recebivel } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { NavegadorMes } from '@/paginas/pagamentos/ResumoContas'
import { nomeDaOrigem, ORIGENS, STATUS } from './formulario'
import { ProximosRecebiveis } from './ProximosRecebiveis'

type AbaRecebiveis = 'mes' | 'a-receber' | 'recebidos' | 'resumo'

/**
 * /recebiveis: valores a receber do mês (pela data prevista). Os três números do mês ficam em cima;
 * embaixo, abas com a lista do mês, o que falta receber (inclui os recebidos em parte), o que já
 * entrou e o resumo (por origem e os próximos 30 dias). Status e saldo vêm da API.
 */
export function Recebiveis() {
  const [params, setParams] = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesDe()
  const mudarMes = (m: string) =>
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual)
        novo.set('mes', m)
        return novo
      },
      { replace: true },
    )

  // Uma busca do mês; as abas filtram pelo status que veio da API.
  const consulta = useRecebiveis(intervaloDoMes(mes))
  const lista = consulta.data ?? []
  const aReceber = lista.filter((r) => r.status !== 'recebido')
  const recebidos = lista.filter((r) => r.status === 'recebido')
  const novo = `/recebiveis/novo?mes=${mes}`
  const listar = (itens: Recebivel[], rotulo: string, vazio: ReactNode) => (
    <ListaRecebiveis consulta={consulta} itens={itens} rotulo={rotulo} vazio={vazio} />
  )

  return (
    <Pagina
      titulo="Recebíveis"
      acoes={
        <Button asChild variant="secondary">
          <Link to={novo}>
            <PlusIcon weight="bold" aria-hidden />
            Novo recebível
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <NavegadorMes mes={mes} aoMudar={mudarMes} />
        {lista.length > 0 && <Resumo lista={lista} />}

        <Abas<AbaRecebiveis>
          rotulo="Partes de Recebíveis"
          abas={[
            {
              valor: 'mes',
              rotulo: 'Do mês',
              conteudo: listar(
                lista,
                'Recebíveis do mês',
                <EstadoVazio
                  icone={HandCoinsIcon}
                  titulo={`Nenhum recebível em ${nomeDoMes(mes).toLowerCase()}`}
                  acao={
                    <Button asChild>
                      <Link to={novo}>Cadastrar recebível</Link>
                    </Button>
                  }
                >
                  Aluguéis, dividendos, rendimentos e honorários que você espera receber.
                </EstadoVazio>,
              ),
            },
            {
              valor: 'a-receber',
              rotulo: 'A receber',
              contador: aReceber.length,
              conteudo: listar(
                aReceber,
                'Recebíveis a receber',
                <EstadoVazio icone={HandCoinsIcon} titulo={`Nada a receber em ${nomeDoMes(mes).toLowerCase()}`} />,
              ),
            },
            {
              valor: 'recebidos',
              rotulo: 'Recebidos',
              conteudo: listar(
                recebidos,
                'Recebíveis recebidos',
                <EstadoVazio icone={HandCoinsIcon} titulo={`Nada recebido em ${nomeDoMes(mes).toLowerCase()}`} />,
              ),
            },
            {
              valor: 'resumo',
              rotulo: 'Resumo',
              conteudo: (
                <div className="grid items-start gap-5 md:grid-cols-2">
                  <PorOrigem mes={mes} />
                  <ProximosRecebiveis />
                </div>
              ),
            },
          ]}
        />
      </div>
    </Pagina>
  )
}

/** Carregando, erro, vazio ou a lista de recebíveis. */
function ListaRecebiveis({
  consulta,
  itens,
  rotulo,
  vazio,
}: {
  consulta: { isPending: boolean; isError: boolean; refetch: () => unknown }
  itens: Recebivel[]
  rotulo: string
  vazio: ReactNode
}) {
  if (consulta.isPending)
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Carregando recebíveis">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-16" />
        ))}
      </div>
    )
  if (consulta.isError)
    return (
      <EstadoVazio
        icone={HandCoinsIcon}
        titulo="Não foi possível carregar os recebíveis"
        acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
      >
        Verifique a internet e tente de novo.
      </EstadoVazio>
    )
  if (itens.length === 0) return vazio
  return (
    <ul className="superficie flex flex-col divide-y divide-linha overflow-hidden" aria-label={rotulo}>
      {itens.map((r) => (
        <Linha key={r.id} recebivel={r} />
      ))}
    </ul>
  )
}

/** Previsto, já recebido, o que falta e o atrasado, das linhas da lista (os valores vêm da API). */
function Resumo({ lista }: { lista: Recebivel[] }) {
  const soma = (f: (r: Recebivel) => number) => lista.reduce((s, r) => s + f(r), 0)
  // O que falta dos que já passaram da data prevista (o `atrasado` vem da API).
  const atrasado = soma((r) => (r.atrasado ? r.saldoCentavos : 0))
  const itens = [
    { rotulo: 'Previsto', valor: soma((r) => r.valorPrevistoCentavos), cor: '' },
    { rotulo: 'Recebido', valor: soma((r) => r.recebidoCentavos), cor: 'text-ok' },
    { rotulo: 'A receber', valor: soma((r) => r.saldoCentavos), cor: '' },
    { rotulo: 'Atrasado', valor: atrasado, cor: atrasado > 0 ? 'text-atraso' : '' },
  ]
  return (
    // Uma superfície só: 2 × 2 no celular, os 4 lado a lado no computador.
    <dl className="superficie grid grid-cols-2 overflow-hidden lg:grid-cols-4">
      {itens.map((i, n) => (
        <div
          key={i.rotulo}
          className={cn(
            'min-w-0 px-4 py-3',
            n % 2 === 1 && 'border-l border-linha',
            n >= 2 && 'border-t border-linha lg:border-t-0',
            n === 2 && 'lg:border-l',
          )}
        >
          <dt className="text-[0.88rem] text-muted-foreground">{i.rotulo}</dt>
          <dd className={cn('text-lg font-bold tabular-nums', i.cor)}>{formatarCentavos(i.valor)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Previsto no mês por origem (aluguel, dividendos...), com o recebido e o que falta, do relatório financeiro. */
function PorOrigem({ mes }: { mes: string }) {
  const consulta = useRelatorioFinanceiro(intervaloDoMes(mes))
  return (
    <Bloco titulo="Previsto por origem" area="recebiveis" consulta={consulta}>
      {() => {
        const porOrigem = consulta.data!.entradas.porOrigem
        if (porOrigem.length === 0) return <Vazio>Nenhum recebível previsto neste mês.</Vazio>
        return (
          <ul className="flex flex-col divide-y divide-linha" aria-label="Previsto no mês por origem">
            {porOrigem.map((o) => (
              <li key={o.origem} className="flex flex-col gap-0.5 py-2.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{ORIGENS[o.origem]}</span>
                  <span className="font-bold tabular-nums">{formatarCentavos(o.totalCentavos)}</span>
                </span>
                <span className="text-[0.88rem] text-muted-foreground">
                  Recebido <span className="font-semibold text-ok">{formatarCentavos(o.recebidoCentavos)}</span> · a
                  receber {formatarCentavos(o.pendenteCentavos)}
                </span>
              </li>
            ))}
          </ul>
        )
      }}
    </Bloco>
  )
}

function Situacao({ r }: { r: Recebivel }) {
  if (r.status === 'recebido')
    return (
      <SeloEstado estado="feito">
        {r.ultimoRecebimento ? `Recebido em ${dataCurta(r.ultimoRecebimento)}` : 'Recebido'}
      </SeloEstado>
    )
  if (r.atrasado)
    return (
      <SeloEstado estado="vencido">
        {r.status === 'parcial' ? 'Em parte, atrasado' : 'Atrasado'} · previsto {dataCurta(r.dataPrevista)}
      </SeloEstado>
    )
  if (r.status === 'parcial')
    return <SeloEstado estado="a_definir">{STATUS[r.status]} · previsto {dataCurta(r.dataPrevista)}</SeloEstado>
  return (
    <span>
      {STATUS[r.status]} · previsto {dataCurta(r.dataPrevista)}
    </span>
  )
}

function Linha({ recebivel: r }: { recebivel: Recebivel }) {
  return (
    <li>
      <Link to={`/recebiveis/${r.id}`} className="flex flex-col gap-0.5 px-4 py-3 hover:bg-suave/50">
        <span className="flex items-start justify-between gap-3">
          <span className="leading-snug font-semibold">{r.descricao}</span>
          <span className="shrink-0 font-bold tabular-nums">{formatarCentavos(r.valorPrevistoCentavos)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-[0.88rem] text-muted-foreground">
          {nomeDaOrigem(r)}
          {r.recorrencia !== 'nenhuma' && (
            <span className="flex items-center gap-1">
              <RepeatIcon className="size-4" aria-hidden />
              {r.recorrencia === 'mensal' ? 'Todo mês' : 'Todo ano'}
            </span>
          )}
          {r.status === 'parcial' && (
            <>
              <span aria-hidden>·</span>
              <span>Falta {formatarCentavos(r.saldoCentavos)}</span>
            </>
          )}
        </span>
        <span className="text-[0.88rem] text-muted-foreground">
          <Situacao r={r} />
        </span>
      </Link>
    </li>
  )
}
