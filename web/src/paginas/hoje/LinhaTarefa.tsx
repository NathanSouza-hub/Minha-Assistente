import { useState } from 'react'
import { ArrowCounterClockwiseIcon, ArrowRightIcon, DotsThreeIcon, XIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { MarcaEstado, SeloEstado } from '@/components/Estado'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import type { TarefaHoje } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { CATEGORIAS, useMarcar } from '@/paginas/hoje/tarefas'

/**
 * Uma linha do Início: o círculo de concluir à esquerda (≥ 44px), título, horário e detalhe com o
 * ponto da área, e o ⋯ com as outras ações (Não fiz, Voltar para pendente, Abrir).
 */
export function LinhaTarefa({ tarefa: t, data, agora = false }: { tarefa: TarefaHoje; data: string; agora?: boolean }) {
  const marcarComo = useMarcar(t, data)
  const [opcoes, setOpcoes] = useState(false)
  const { area, feito, naoFeito } = CATEGORIAS[t.categoria]
  const estado = t.status === 'feito' ? 'feito' : t.status === 'nao_feito' ? 'nao_feito' : agora ? 'agora' : 'pendente'
  const encerrada = t.status === 'feito' || t.status === 'nao_feito'
  const venceHoje = t.categoria === 'despesa' && t.status === 'pendente' && !t.horario
  // Sem horário, detalhe nem estado, a linha de apoio teria só o ponto da área: fica fora.
  const temApoio = Boolean(t.horario || t.detalhe || t.status === 'nao_feito' || venceHoje)

  return (
    <li className={cn('flex items-center gap-1 py-1.5 pr-1 pl-1', `area-${area}`)}>
      <button
        type="button"
        onClick={() => marcarComo('feito')}
        aria-label={`${feito}: ${t.titulo}`}
        aria-pressed={t.status === 'feito'}
        className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-suave"
      >
        <MarcaEstado estado={estado} />
      </button>
      <Link to={t.link} className="min-w-0 flex-1 rounded-lg py-1.5 hover:bg-suave/50">
        <p
          className={cn(
            'text-base leading-snug font-semibold break-words',
            encerrada && 'font-medium text-muted-foreground',
            t.status === 'feito' && 'line-through',
          )}
        >
          {t.titulo}
        </p>
        {/* Texto corrido (não flex): se quebrar, o ponto da área acompanha a primeira palavra. */}
        {temApoio && (
          <p className="mt-0.5 text-[0.88rem] leading-snug text-muted-foreground">
          <span aria-hidden className="mr-1.5 mb-[0.12em] inline-block size-[0.45rem] rounded-full bg-area align-middle" />
          {t.horario && (
            <span
              className={cn(
                'font-semibold tabular-nums',
                t.status === 'atrasado' && 'text-atraso',
                agora && !encerrada && 'text-primary',
              )}
            >
              {t.horario}
              {t.status === 'atrasado' && <span className="sr-only"> (atrasado)</span>}
            </span>
          )}
          {agora && !encerrada && <SeloEstado estado="agora" className="ml-1">· agora</SeloEstado>}
          {/* O "·" vai junto do detalhe: se ele quebrar, o ponto não fica sobrando no fim da linha. */}
          {t.detalhe && (
            <span className={cn(t.status === 'atrasado' && !t.horario && 'text-atraso')}>
              {t.horario && <span aria-hidden> · </span>}
              {t.detalhe}
            </span>
          )}
          {t.status === 'nao_feito' && <SeloEstado estado="nao_feito" className="ml-1">{`· ${naoFeito.toLowerCase()}`}</SeloEstado>}
          {venceHoje && <SeloEstado estado="vence_hoje" className="ml-1.5" />}
          </p>
        )}
      </Link>
      <button
        type="button"
        onClick={() => setOpcoes(true)}
        aria-label={`Mais opções: ${t.titulo}`}
        className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-suave hover:text-foreground"
      >
        <DotsThreeIcon weight="bold" className="size-6" aria-hidden />
      </button>

      <Sheet open={opcoes} onOpenChange={setOpcoes}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="mx-auto max-w-xl rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="text-lg font-bold">{t.titulo}</SheetTitle>
          <SheetDescription className="-mt-3 text-base text-muted-foreground">
            {[t.horario, t.detalhe].filter(Boolean).join(' · ') || CATEGORIAS[t.categoria].nome}
          </SheetDescription>
          <div className="flex flex-col gap-2">
            {t.status !== 'nao_feito' && (
              <Button
                variant="outline"
                size="lg"
                className="justify-start"
                onClick={() => {
                  setOpcoes(false)
                  marcarComo('nao_feito')
                }}
              >
                <XIcon weight="bold" aria-hidden />
                {naoFeito}
              </Button>
            )}
            {encerrada && (
              <Button
                variant="outline"
                size="lg"
                className="justify-start"
                onClick={() => {
                  setOpcoes(false)
                  marcarComo('pendente')
                }}
              >
                <ArrowCounterClockwiseIcon weight="bold" aria-hidden />
                Voltar para pendente
              </Button>
            )}
            <Button asChild variant="outline" size="lg" className="justify-start">
              <Link to={t.link}>
                <ArrowRightIcon weight="bold" aria-hidden />
                Abrir {CATEGORIAS[t.categoria].nome.toLowerCase()}
              </Link>
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setOpcoes(false)}>
              Fechar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </li>
  )
}
