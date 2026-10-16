import type { ReactNode } from 'react'
import { CircleAlert, Sun } from 'lucide-react'
import { Link } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePainelHoje } from '@/consultas/hoje'
import { agora, hojeISO } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { PainelHoje } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { ItemEvento } from '@/paginas/agenda/ItemEvento'
import { ItemPagamento } from '@/paginas/pagamentos/ItemPagamento'
import { ItemDose } from '@/paginas/remedios/ItemDose'
import { ItemTarefa } from '@/paginas/rotina/ItemTarefa'

function CabecalhoHoje() {
  const hoje = agora()
  return (
    <div className="relative pl-5">
      {/* Fita açafrão: o marcador de página da agenda, preso no dia de hoje. */}
      <span aria-hidden className="absolute top-1 bottom-1 left-0 w-1.5 rounded-full bg-hoje" />
      <h1 className="flex flex-col">
        <span className="text-xl font-semibold text-muted-foreground first-letter:uppercase">
          {hoje.toFormat('cccc')}
        </span>
        <span className="text-[2.75rem] leading-[1.05] font-bold tracking-tight text-primary md:text-6xl">
          {hoje.toFormat("d 'de' LLLL")}
        </span>
      </h1>
    </div>
  )
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** "2 agendamentos, 3 remédios e 1 compromisso para hoje." */
function frase(r: PainelHoje['resumo']) {
  const partes = [
    r.eventos && plural(r.eventos, 'agendamento', 'agendamentos'),
    r.remediosPendentes && plural(r.remediosPendentes, 'remédio para tomar', 'remédios para tomar'),
    r.tarefasPendentes && plural(r.tarefasPendentes, 'compromisso', 'compromissos'),
  ].filter(Boolean) as string[]
  if (partes.length === 0) return null
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`
  return `Para hoje: ${lista}.`
}

function Secao({
  id,
  titulo,
  detalhe,
  link,
  destaque,
  children,
}: {
  id: string
  titulo: string
  detalhe?: ReactNode
  link: { para: string; rotulo: string }
  destaque?: boolean
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className={cn('flex items-center gap-2 text-xl font-bold', destaque && 'text-atraso')}>
          {destaque && <CircleAlert className="size-6" aria-hidden />}
          {titulo}
        </h2>
        <Link to={link.para} className="font-semibold text-primary underline underline-offset-4">
          {link.rotulo}
        </Link>
      </div>
      {detalhe && (
        <p
          className={cn('-mt-1 text-base', destaque ? 'font-semibold text-atraso' : 'text-muted-foreground')}
        >
          {detalhe}
        </p>
      )}
      {children}
    </section>
  )
}

export function Hoje() {
  const data = hojeISO()
  const consulta = usePainelHoje(data)

  return (
    <Pagina titulo="Hoje" cabecalho={<CabecalhoHoje />}>
      {consulta.isPending ? (
        <div role="status" aria-label="Carregando o dia" className="flex flex-col gap-4">
          <Skeleton className="h-6 w-2/3" />
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : consulta.isError ? (
        <EstadoVazio
          icone={Sun}
          titulo="Não foi possível carregar o seu dia"
          acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
        >
          Verifique a internet e tente de novo.
        </EstadoVazio>
      ) : (
        <Painel painel={consulta.data} />
      )}
    </Pagina>
  )
}

function Painel({ painel }: { painel: PainelHoje }) {
  const { resumo, eventos, medicamentos, rotina, pagamentos } = painel
  const resumoTexto = frase(resumo)
  const tomados = medicamentos.filter((m) => m.tomado).length
  const feitas = rotina.filter((t) => t.concluida).length
  const nadaNoDia =
    eventos.length +
      medicamentos.length +
      rotina.length +
      pagamentos.vencidos.length +
      pagamentos.aVencer.length ===
    0

  if (nadaNoDia) {
    return (
      <EstadoVazio
        icone={Sun}
        titulo="Dia livre"
        acao={
          <Button asChild>
            <Link to="/agenda/novo">Novo agendamento</Link>
          </Button>
        }
      >
        Nada agendado, nenhum remédio, compromisso ou conta para hoje.
      </EstadoVazio>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {resumoTexto && (
        <p className="-mt-2 text-lg text-muted-foreground" aria-live="polite">
          {resumoTexto}
        </p>
      )}

      {pagamentos.vencidos.length > 0 && (
        <Secao
          id="hoje-vencidas"
          titulo={pagamentos.vencidos.length === 1 ? 'Conta vencida' : 'Contas vencidas'}
          detalhe={`${formatarCentavos(pagamentos.totalVencidoCentavos)} em atraso`}
          link={{ para: '/pagamentos?status=pendente', rotulo: 'Ver pagamentos' }}
          destaque
        >
          <ul className="flex flex-col gap-3">
            {pagamentos.vencidos.map((p) => (
              <ItemPagamento key={p.id} pagamento={p} />
            ))}
          </ul>
        </Secao>
      )}

      <Secao id="hoje-agenda" titulo="Agendamentos" link={{ para: '/agenda', rotulo: 'Ver agenda' }}>
        {eventos.length ? (
          <ul className="flex flex-col gap-3">
            {eventos.map((e) => (
              <ItemEvento key={`${e.id}-${e.inicio}`} evento={e} />
            ))}
          </ul>
        ) : (
          <p className="text-base text-muted-foreground">Nada marcado para hoje.</p>
        )}
      </Secao>

      {medicamentos.length > 0 && (
        <Secao
          id="hoje-remedios"
          titulo="Remédios"
          detalhe={
            tomados === medicamentos.length
              ? 'Tudo tomado.'
              : `${tomados} de ${medicamentos.length} ${medicamentos.length === 1 ? 'tomado' : 'tomados'}`
          }
          link={{ para: '/remedios', rotulo: 'Ver remédios' }}
        >
          <ul className="flex flex-col gap-3">
            {medicamentos.map((d) => (
              <ItemDose key={d.horarioId} dose={d} futuro={false} />
            ))}
          </ul>
        </Secao>
      )}

      {rotina.length > 0 && (
        <Secao
          id="hoje-rotina"
          titulo="Compromissos"
          detalhe={
            feitas === rotina.length
              ? 'Todos feitos.'
              : `${feitas} de ${rotina.length} ${rotina.length === 1 ? 'feito' : 'feitos'}`
          }
          link={{ para: '/rotina', rotulo: 'Ver compromissos' }}
        >
          <ul className="flex flex-col gap-3">
            {rotina.map((t) => (
              <ItemTarefa key={t.rotinaId} tarefa={t} desabilitada={false} />
            ))}
          </ul>
        </Secao>
      )}

      {pagamentos.aVencer.length > 0 && (
        <Secao
          id="hoje-a-vencer"
          titulo="Contas dos próximos 7 dias"
          detalhe={`${formatarCentavos(pagamentos.totalAVencerCentavos)} no total`}
          link={{ para: '/pagamentos', rotulo: 'Ver pagamentos' }}
        >
          <ul className="flex flex-col gap-3">
            {pagamentos.aVencer.map((p) => (
              <ItemPagamento key={p.id} pagamento={p} />
            ))}
          </ul>
        </Secao>
      )}
    </div>
  )
}
