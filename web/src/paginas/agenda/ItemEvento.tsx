import { ArrowSquareOutIcon, MapPinIcon, RepeatIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { areaDaRota } from '@/app/navegacao'
import { Button } from '@/components/ui/button'
import { agora, deDataHoraISO, horaDe } from '@/lib/datas'
import type { Evento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { AREAS_DO_TIPO, MODALIDADES, nomeDoTipo, ONLINE, RECORRENCIAS } from './textos'

/** `voltar`: rota para onde o formulário volta ao salvar (ex.: a área "Programa de rádio"). */
export function ItemEvento({ evento: e, voltar }: { evento: Evento; voltar?: string }) {
  const fimOuInicio = deDataHoraISO(e.fim ?? e.inicio)
  const passou = fimOuInicio < agora()
  const acontecendo = !passou && deDataHoraISO(e.inicio) <= agora()
  const online = e.modalidade !== null && ONLINE.includes(e.modalidade)
  // Rádio, atividade física e fisioterapia têm cor própria; o resto fica na cor da Agenda.
  const area = areaDaRota(AREAS_DO_TIPO.find((a) => a.tipo === e.tipo)?.rota ?? '/agenda')
  const detalhes = [nomeDoTipo(e), e.modalidade && MODALIDADES[e.modalidade]].filter(Boolean).join(', ')
  const profissional = [e.profissional, e.especialidade].filter(Boolean).join(' · ')

  return (
    <li className={cn('flex flex-col gap-3 py-3', `area-${area}`)}>
      <Link
        to={`/agenda/${e.id}${voltar ? `?voltar=${encodeURIComponent(voltar)}` : ''}`}
        className="-mx-2 grid grid-cols-[5.5rem_1fr] gap-3 rounded-lg px-2 py-1 hover:bg-suave/70"
      >
        <span className={cn('flex flex-col border-l-4 border-area pl-2.5', passou && 'border-area/40 text-muted-foreground')}>
          <span className="text-xl font-bold tabular-nums">{horaDe(e.inicio)}</span>
          {e.fim && <span className="text-base whitespace-nowrap tabular-nums text-muted-foreground">até {horaDe(e.fim)}</span>}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className={cn('text-lg leading-snug font-bold', passou && 'text-muted-foreground')}>
            {e.titulo}
          </span>
          {acontecendo && (
            <strong className="self-start rounded-full bg-secondary px-2.5 text-base font-semibold text-primary">
              Acontecendo agora
            </strong>
          )}
          <span className="text-base text-muted-foreground">{detalhes}</span>
          {profissional && <span className="text-base">{profissional}</span>}
          {e.local && (
            <span className="flex items-start gap-1.5 text-base">
              <MapPinIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              {e.local}
            </span>
          )}
          {e.recorrencia !== 'nenhuma' && (
            <span className="flex items-center gap-1.5 text-base text-muted-foreground">
              <RepeatIcon className="size-5" aria-hidden />
              {RECORRENCIAS[e.recorrencia]}
            </span>
          )}
        </span>
      </Link>
      {e.link && !passou && (
        <Button asChild variant={online && acontecendo ? 'default' : 'outline'} className="sm:self-start">
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
