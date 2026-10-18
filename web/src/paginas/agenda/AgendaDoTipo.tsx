import { CalendarDotsIcon, PlusIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEventos } from '@/consultas/eventos'
import { hojeISO, rotuloDoDia, somarDias } from '@/lib/datas'
import type { TipoEvento } from '@/lib/tipos'
import { CabecalhoDia, ListaEventos } from './Agenda'
import { porDia } from './porDia'
import { TIPOS } from './textos'

const DIAS = 60

/**
 * Áreas "Programa de rádio", "Atividade física" e "Fisioterapia": a agenda só daquele tipo, nos
 * próximos dias. "Novo" já vem com o tipo, e salvar volta para cá (`voltar`).
 */
export function AgendaDoTipo({ tipo, rota }: { tipo: TipoEvento; rota: string }) {
  const inicio = hojeISO()
  const consulta = useEventos({ inicio, fim: somarDias(inicio, DIAS), tipo })
  const eventos = consulta.data ?? []
  const novo = `/agenda/novo?tipo=${tipo}&voltar=${encodeURIComponent(rota)}`

  return (
    <Pagina
      titulo={TIPOS[tipo]}
      acoes={
        <Button asChild size="lg">
          <Link to={novo}>
            <PlusIcon weight="bold" aria-hidden />
            Novo
          </Link>
        </Button>
      }
    >
      {consulta.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando agenda">
          {[1, 2].map((n) => (
            <Skeleton key={n} className="h-24" />
          ))}
        </div>
      ) : consulta.isError ? (
        <EstadoVazio
          icone={CalendarDotsIcon}
          titulo="Não foi possível carregar a agenda"
          acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
        >
          Verifique a internet e tente de novo.
        </EstadoVazio>
      ) : eventos.length === 0 ? (
        <EstadoVazio
          icone={CalendarDotsIcon}
          titulo={`Nada marcado nos próximos ${DIAS} dias`}
          acao={
            <Button asChild>
              <Link to={novo}>Novo agendamento</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...porDia(eventos, inicio)].map(([dia, doDia]) => (
            <section key={dia} className="flex flex-col gap-1">
              <CabecalhoDia dia={dia} />
              <ListaEventos eventos={doDia} rotulo={`${TIPOS[tipo]} de ${rotuloDoDia(dia)}`} voltar={rota} />
            </section>
          ))}
        </div>
      )}
    </Pagina>
  )
}
