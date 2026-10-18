import type { ReactNode } from 'react'
import {
  CalendarDotsIcon,
  CaretRightIcon,
  CheckSquareIcon,
  PillIcon,
  SunIcon,
  WalletIcon,
  WarningCircleIcon,
  type Icon,
} from '@phosphor-icons/react'
import { Link } from 'react-router'
import type { Area } from '@/app/navegacao'
import { useSessao } from '@/app/useSessao'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePainelHoje } from '@/consultas/hoje'
import { agora, dataPorExtenso, hojeISO } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { PainelHoje } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { ItemEvento } from '@/paginas/agenda/ItemEvento'
import { ItemPagamento } from '@/paginas/pagamentos/ItemPagamento'
import { ItemDose } from '@/paginas/remedios/ItemDose'
import { ItemTarefa } from '@/paginas/rotina/ItemTarefa'

/** "Bom dia" até o meio-dia, "Boa tarde" até as 18h, "Boa noite" depois (e de madrugada). */
function saudacao(hora: number) {
  if (hora >= 5 && hora < 12) return 'Bom dia'
  if (hora >= 12 && hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** "Bom dia, Débora", a data por extenso e o resumo do dia, na capa. */
function CabecalhoHoje({ resumo }: { resumo: string | null }) {
  const { usuario } = useSessao()
  const hoje = agora()
  const primeiroNome = usuario?.nome.trim().split(/\s+/)[0]
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[2rem] leading-tight font-[750] tracking-[-0.01em] md:text-[2.5rem]">
        {saudacao(hoje.hour)}
        {primeiroNome && `, ${primeiroNome}`}
      </h1>
      <p className="text-lg font-semibold text-muted-foreground">{dataPorExtenso(hoje.toISODate()!)}</p>
      {resumo && (
        <p className="mt-2 max-w-prose text-lg" aria-live="polite">
          {resumo}
        </p>
      )}
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

/** Grupo do dia: selo da área, título, andamento ("1 de 4 tomados") e o atalho para a área. */
function Secao({
  id,
  area,
  icone: Icone,
  titulo,
  detalhe,
  link,
  children,
}: {
  id: string
  area: Area
  icone: Icon
  titulo: string
  detalhe?: ReactNode
  link: { para: string; rotulo: string }
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-1', `area-${area}`)}>
      <div className="flex items-center gap-3">
        <span className="selo-area size-11" aria-hidden>
          <Icone className="size-6" weight="fill" />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4">
          <h2 id={id} className="text-xl font-bold">
            {titulo}
          </h2>
          {detalhe && <p className="text-base text-muted-foreground">{detalhe}</p>}
        </div>
      </div>
      {children}
      <Link
        to={link.para}
        className="-mx-2 flex min-h-11 items-center gap-1 self-start rounded-lg px-2 font-semibold text-area hover:bg-area-fundo/60"
      >
        {link.rotulo}
        <CaretRightIcon className="size-5" weight="bold" aria-hidden />
      </Link>
    </section>
  )
}

export function Hoje() {
  const data = hojeISO()
  const consulta = usePainelHoje(data)

  return (
    <Pagina
      titulo="Hoje"
      cabecalho={<CabecalhoHoje resumo={consulta.data ? frase(consulta.data.resumo) : null} />}
    >
      {consulta.isPending ? (
        <div role="status" aria-label="Carregando o dia" className="flex flex-col gap-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex flex-col gap-3">
              <Skeleton className="h-11 w-1/2" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ))}
        </div>
      ) : consulta.isError ? (
        <EstadoVazio
          icone={SunIcon}
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
  const { eventos, medicamentos, rotina, pagamentos } = painel
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
        icone={SunIcon}
        titulo="Dia livre"
        acao={
          <Button asChild>
            <Link to="/agenda/novo">Novo agendamento</Link>
          </Button>
        }
      >
        Nenhum agendamento, remédio, compromisso ou conta para hoje. Aproveite!
      </EstadoVazio>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {pagamentos.vencidos.length > 0 && <ContasVencidas pagamentos={pagamentos} />}

      <Secao
        id="hoje-agenda"
        area="agenda"
        icone={CalendarDotsIcon}
        titulo="Agendamentos"
        link={{ para: '/agenda', rotulo: 'Ver agenda' }}
      >
        {eventos.length ? (
          <ul className="flex flex-col divide-y divide-linha">
            {eventos.map((e) => (
              <ItemEvento key={`${e.id}-${e.inicio}`} evento={e} />
            ))}
          </ul>
        ) : (
          <p className="py-3 text-muted-foreground">Nada marcado para hoje.</p>
        )}
      </Secao>

      {medicamentos.length > 0 && (
        <Secao
          id="hoje-remedios"
          area="remedios"
          icone={PillIcon}
          titulo="Remédios"
          detalhe={
            tomados === medicamentos.length
              ? 'Tudo tomado.'
              : `${tomados} de ${medicamentos.length} ${medicamentos.length === 1 ? 'tomado' : 'tomados'}`
          }
          link={{ para: '/remedios', rotulo: 'Ver remédios' }}
        >
          <ul className="flex flex-col divide-y divide-linha">
            {medicamentos.map((d) => (
              <ItemDose key={d.horarioId} dose={d} futuro={false} />
            ))}
          </ul>
        </Secao>
      )}

      {rotina.length > 0 && (
        <Secao
          id="hoje-rotina"
          area="compromissos"
          icone={CheckSquareIcon}
          titulo="Compromissos"
          detalhe={
            feitas === rotina.length
              ? 'Todos feitos.'
              : `${feitas} de ${rotina.length} ${rotina.length === 1 ? 'feito' : 'feitos'}`
          }
          link={{ para: '/rotina', rotulo: 'Ver compromissos' }}
        >
          <ul className="flex flex-col divide-y divide-linha">
            {rotina.map((t) => (
              <ItemTarefa key={t.rotinaId} tarefa={t} desabilitada={false} />
            ))}
          </ul>
        </Secao>
      )}

      {pagamentos.aVencer.length > 0 && (
        <Secao
          id="hoje-a-vencer"
          area="contas"
          icone={WalletIcon}
          titulo="Contas dos próximos 7 dias"
          detalhe={`${formatarCentavos(pagamentos.totalAVencerCentavos)} no total`}
          link={{ para: '/despesas', rotulo: 'Ver despesas' }}
        >
          <ul className="flex flex-col divide-y divide-linha">
            {pagamentos.aVencer.map((p) => (
              <ItemPagamento key={p.id} pagamento={p} />
            ))}
          </ul>
        </Secao>
      )}
    </div>
  )
}

/** Contas em atraso vêm primeiro, numa folha vinho-clara: é o único aviso do dia. */
function ContasVencidas({ pagamentos }: { pagamentos: PainelHoje['pagamentos'] }) {
  const titulo = pagamentos.vencidos.length === 1 ? 'Conta vencida' : 'Contas vencidas'
  return (
    <section
      aria-labelledby="hoje-vencidas"
      className="-mx-4 flex flex-col gap-1 bg-atraso-fundo px-4 pt-4 pb-2 sm:mx-0 sm:rounded-xl"
    >
      <div className="flex items-center gap-3">
        <WarningCircleIcon className="size-8 shrink-0 text-atraso" weight="fill" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="hoje-vencidas" className="text-xl font-bold text-atraso">
            {titulo}
          </h2>
          <p className="font-semibold text-atraso">
            {formatarCentavos(pagamentos.totalVencidoCentavos)} em atraso
          </p>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-atraso/20">
        {pagamentos.vencidos.map((p) => (
          <ItemPagamento key={p.id} pagamento={p} />
        ))}
      </ul>
      <Link
        to="/despesas?status=pendente"
        className="-mx-2 flex min-h-11 items-center gap-1 self-start rounded-lg px-2 font-semibold text-atraso hover:bg-atraso/8"
      >
        Ver despesas
        <CaretRightIcon className="size-5" weight="bold" aria-hidden />
      </Link>
    </section>
  )
}
