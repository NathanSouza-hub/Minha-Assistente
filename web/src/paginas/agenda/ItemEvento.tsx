import { ArrowSquareOutIcon, MapPinIcon, RepeatIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { areaDaRota } from '@/app/navegacao'
import { SeloEstado } from '@/components/Estado'
import { Button } from '@/components/ui/button'
import { agora, deDataHoraISO, horaDe } from '@/lib/datas'
import type { Evento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { AREAS_DO_TIPO, MODALIDADES, nomeDoTipo, ONLINE, RECORRENCIAS } from './textos'

/**
 * Um agendamento, no molde das linhas do Início: horário à esquerda, título e o detalhe com o ponto
 * na cor da área do tipo (rádio, atividade física, fisioterapia; o resto na cor da Agenda).
 * `voltar`: rota para onde o formulário volta ao salvar (ex.: a área "Programa de rádio").
 */
export function ItemEvento({ evento: e, voltar }: { evento: Evento; voltar?: string }) {
  const fimOuInicio = deDataHoraISO(e.fim ?? e.inicio)
  const passou = fimOuInicio < agora()
  const acontecendo = !passou && deDataHoraISO(e.inicio) <= agora()
  const online = e.modalidade !== null && ONLINE.includes(e.modalidade)
  const area = areaDaRota(AREAS_DO_TIPO.find((a) => a.tipo === e.tipo)?.rota ?? '/agenda')
  const detalhes = [nomeDoTipo(e), e.modalidade && MODALIDADES[e.modalidade]].filter(Boolean).join(', ')
  const profissional = [e.profissional, e.especialidade].filter(Boolean).join(' · ')

  return (
    <li className={cn('flex flex-col gap-2 px-4 py-3', `area-${area}`)}>
      <Link
        to={`/agenda/${e.id}${voltar ? `?voltar=${encodeURIComponent(voltar)}` : ''}`}
        className="-mx-2 grid grid-cols-[4.25rem_1fr] gap-3 rounded-lg px-2 py-0.5 hover:bg-suave/50"
      >
        <span className={cn('flex flex-col', passou && 'text-muted-foreground')}>
          <span className={cn('font-bold tabular-nums', acontecendo && 'text-primary')}>{horaDe(e.inicio)}</span>
          {e.fim && (
            <span className="text-apoio whitespace-nowrap tabular-nums text-muted-foreground">até {horaDe(e.fim)}</span>
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cn('leading-snug font-semibold break-words', passou && 'font-medium text-muted-foreground')}>
            {e.titulo}
          </span>
          <span className="text-apoio leading-snug text-muted-foreground">
            <span aria-hidden className="mr-1.5 mb-[0.12em] inline-block size-[0.45rem] rounded-full bg-area align-middle" />
            {acontecendo && (
              <SeloEstado estado="agora" className="mr-1">
                Acontecendo agora ·
              </SeloEstado>
            )}
            {detalhes}
          </span>
          {profissional && <span className="text-apoio text-foreground">{profissional}</span>}
          {e.local && (
            <span className="flex items-start gap-1 text-apoio text-muted-foreground">
              <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {e.local}
            </span>
          )}
          {e.recorrencia !== 'nenhuma' && (
            <span className="flex items-center gap-1 text-apoio text-muted-foreground">
              <RepeatIcon className="size-4" aria-hidden />
              {RECORRENCIAS[e.recorrencia]}
            </span>
          )}
        </span>
      </Link>
      {e.link && !passou && (
        <Button asChild variant={online && acontecendo ? 'default' : 'outline'} className="sm:ml-[5.25rem] sm:self-start">
          <a href={e.link} target="_blank" rel="noopener noreferrer">
            {online ? <VideoCameraIcon aria-hidden /> : <ArrowSquareOutIcon aria-hidden />}
            {online ? 'Entrar' : 'Abrir link'}
            <span className="sr-only"> em {e.titulo} (abre em outra janela)</span>
          </a>
        </Button>
      )}
    </li>
  )
}
