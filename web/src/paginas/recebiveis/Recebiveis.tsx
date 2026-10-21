import type { ReactNode } from 'react'
import {
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  HandCoinsIcon,
  ListBulletsIcon,
  PlusIcon,
  RepeatIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { Abas } from '@/components/Abas'
import { Bloco, Vazio } from '@/components/Bloco'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRelatorioFinanceiro } from '@/consultas/pagamentos'
import { useRecebiveis } from '@/consultas/recebiveis'
import { dataCurta, intervaloDoMes, mesDe, nomeDoMes } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Recebivel } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { NavegadorMes } from '@/paginas/pagamentos/ResumoContas'
import { ORIGENS, STATUS } from './formulario'
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
      larga
      acoes={
        <Button asChild size="lg">
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
              icone: ListBulletsIcon,
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
              icone: ClockIcon,
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
              icone: CheckCircleIcon,
              conteudo: listar(
                recebidos,
                'Recebíveis recebidos',
                <EstadoVazio icone={HandCoinsIcon} titulo={`Nada recebido em ${nomeDoMes(mes).toLowerCase()}`} />,
              ),
            },
            {
              valor: 'resumo',
              rotulo: 'Resumo',
              icone: ChartBarIcon,
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
    <ul className="flex flex-col divide-y divide-linha rounded-2xl bg-folha px-4 shadow-folha" aria-label={rotulo}>
      {itens.map((r) => (
        <Linha key={r.id} recebivel={r} />
      ))}
    </ul>
  )
}

/** Previsto, já recebido, o que falta e o atrasado, das linhas da lista (os valores vêm da API). */
function Resumo({ lista }: { lista: Recebivel[] }) {
  const soma = (f: (r: Recebivel) => number) => lista.reduce((s, r) => s + f(r), 0)
  const itens = [
    { rotulo: 'Previsto', valor: soma((r) => r.valorPrevistoCentavos), cor: '' },
    { rotulo: 'Recebido', valor: soma((r) => r.recebidoCentavos), cor: 'text-ok' },
    { rotulo: 'A receber', valor: soma((r) => r.saldoCentavos), cor: 'text-alerta' },
    // O que falta dos que já passaram da data prevista (o `atrasado` vem da API).
    { rotulo: 'Atrasado', valor: soma((r) => (r.atrasado ? r.saldoCentavos : 0)), cor: 'text-atraso' },
  ]
  return (
    // No celular estreito, uma linha por número (rótulo à esquerda); a partir de 520px, cartões lado a lado.
    <dl className="grid gap-2 min-[520px]:grid-cols-2 lg:grid-cols-4">
      {itens.map((i) => (
        <div
          key={i.rotulo}
          className="flex items-baseline justify-between gap-3 rounded-xl bg-folha px-4 py-3 shadow-folha min-[520px]:block"
        >
          <dt className="text-base text-muted-foreground">{i.rotulo}</dt>
          <dd className={cn('text-lg font-bold tabular-nums sm:text-xl', i.cor)}>{formatarCentavos(i.valor)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Previsto no mês por origem (aluguel, dividendos...), com o recebido e o que falta, do relatório financeiro. */
function PorOrigem({ mes }: { mes: string }) {
  const consulta = useRelatorioFinanceiro(intervaloDoMes(mes))
  return (
    <Bloco titulo="Previsto por origem" icone={ChartBarIcon} area="recebiveis" consulta={consulta}>
      {() => {
        const porOrigem = consulta.data!.entradas.porOrigem
        if (porOrigem.length === 0) return <Vazio>Nenhum recebível previsto neste mês.</Vazio>
        return (
          <ul className="flex flex-col divide-y divide-linha" aria-label="Previsto no mês por origem">
            {porOrigem.map((o) => (
              <li key={o.origem} className="flex flex-col gap-0.5 py-2.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-bold">{ORIGENS[o.origem]}</span>
                  <span className="font-bold tabular-nums">{formatarCentavos(o.totalCentavos)}</span>
                </span>
                <span className="text-base text-muted-foreground">
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
      <span className="flex items-center gap-1.5 font-semibold text-ok">
        <CheckCircleIcon className="size-5" weight="fill" aria-hidden />
        {r.ultimoRecebimento ? `Recebido em ${dataCurta(r.ultimoRecebimento)}` : 'Recebido'}
      </span>
    )
  if (r.atrasado)
    return (
      <span className="flex items-center gap-1.5 font-semibold text-atraso">
        <WarningCircleIcon className="size-5" weight="fill" aria-hidden />
        {r.status === 'parcial' ? 'Em parte, atrasado' : 'Atrasado'} · previsto {dataCurta(r.dataPrevista)}
      </span>
    )
  return (
    <span className={cn('font-semibold', r.status === 'parcial' ? 'text-alerta' : 'text-muted-foreground')}>
      {STATUS[r.status]} · previsto {dataCurta(r.dataPrevista)}
    </span>
  )
}

function Linha({ recebivel: r }: { recebivel: Recebivel }) {
  return (
    <li>
      <Link to={`/recebiveis/${r.id}`} className="-mx-2 flex flex-col gap-1 rounded-lg px-2 py-3 hover:bg-suave/60">
        <span className="flex items-start justify-between gap-3">
          <span className="text-lg leading-snug font-bold">{r.descricao}</span>
          <span className="shrink-0 text-lg font-bold tabular-nums">{formatarCentavos(r.valorPrevistoCentavos)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 text-base text-muted-foreground">
          {ORIGENS[r.origem]}
          {r.recorrencia !== 'nenhuma' && (
            <span className="flex items-center gap-1">
              <RepeatIcon className="size-4" aria-hidden />
              {r.recorrencia === 'mensal' ? 'Todo mês' : 'Todo ano'}
            </span>
          )}
          {r.status === 'parcial' && <span>Falta {formatarCentavos(r.saldoCentavos)}</span>}
        </span>
        <span className="text-base">
          <Situacao r={r} />
        </span>
      </Link>
    </li>
  )
}
