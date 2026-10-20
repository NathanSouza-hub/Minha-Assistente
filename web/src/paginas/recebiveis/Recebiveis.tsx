import { CheckCircleIcon, HandCoinsIcon, PlusIcon, RepeatIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Opcoes } from '@/components/Opcoes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecebiveis } from '@/consultas/recebiveis'
import { dataCurta, intervaloDoMes, mesDe, nomeDoMes } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Recebivel, StatusRecebivel } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { NavegadorMes } from '@/paginas/pagamentos/ResumoContas'
import { ORIGENS, STATUS } from './formulario'

type FiltroStatus = 'todos' | StatusRecebivel

/** /recebiveis: valores a receber do mês (pela data prevista), com o que já entrou e o que falta. */
export function Recebiveis() {
  const [params, setParams] = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesDe()
  const status = (params.get('status') as FiltroStatus | null) ?? 'todos'
  const mudar = (chave: string, valor: string) =>
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual)
        if (valor && valor !== 'todos') novo.set(chave, valor)
        else novo.delete(chave)
        return novo
      },
      { replace: true },
    )

  const consulta = useRecebiveis({ ...intervaloDoMes(mes), status: status === 'todos' ? undefined : status })
  const lista = consulta.data ?? []
  const novo = `/recebiveis/novo?mes=${mes}`

  return (
    <Pagina
      titulo="Recebíveis"
      acoes={
        <Button asChild size="lg">
          <Link to={novo}>
            <PlusIcon weight="bold" aria-hidden />
            Novo
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <NavegadorMes mes={mes} aoMudar={(m) => mudar('mes', m)} />
        <Opcoes<FiltroStatus>
          rotulo="Mostrar"
          rotuloOculto
          formato="segmentos"
          valor={status}
          aoMudar={(v) => mudar('status', v)}
          opcoes={[
            { valor: 'todos', rotulo: 'Todos' },
            { valor: 'pendente', rotulo: 'A receber' },
            { valor: 'recebido', rotulo: 'Recebidos' },
          ]}
        />

        {lista.length > 0 && <Resumo lista={lista} />}

        {consulta.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Carregando recebíveis">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-16" />
            ))}
          </div>
        ) : consulta.isError ? (
          <EstadoVazio
            icone={HandCoinsIcon}
            titulo="Não foi possível carregar os recebíveis"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          >
            Verifique a internet e tente de novo.
          </EstadoVazio>
        ) : lista.length === 0 ? (
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
          </EstadoVazio>
        ) : (
          <ul className="flex flex-col divide-y divide-linha" aria-label="Recebíveis do mês">
            {lista.map((r) => (
              <Linha key={r.id} recebivel={r} />
            ))}
          </ul>
        )}
      </div>
    </Pagina>
  )
}

/** Previsto, já recebido e o que falta, das linhas da lista (os valores vêm da API). */
function Resumo({ lista }: { lista: Recebivel[] }) {
  const soma = (f: (r: Recebivel) => number) => lista.reduce((s, r) => s + f(r), 0)
  const itens = [
    { rotulo: 'Previsto', valor: soma((r) => r.valorPrevistoCentavos), cor: '' },
    { rotulo: 'Recebido', valor: soma((r) => r.recebidoCentavos), cor: 'text-ok' },
    { rotulo: 'A receber', valor: soma((r) => r.saldoCentavos), cor: 'text-alerta' },
  ]
  return (
    // No celular estreito, uma linha por número (rótulo à esquerda); a partir de 520px, três cartões.
    <dl className="grid gap-2 min-[520px]:grid-cols-3">
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
