import { AirplaneTiltIcon, PaperclipIcon, PlusIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useViagens } from '@/consultas/viagens'
import { deDataISO, hojeISO } from '@/lib/datas'
import type { Viagem } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { contarAnexos, descreverPeriodo, situacaoViagem, type Fase } from './textos'

export function Viagens() {
  const consulta = useViagens()
  const viagens = consulta.data ?? []
  const hoje = hojeISO()
  const daFase = (fase: Fase) => viagens.filter((v) => situacaoViagem(v.ida, v.volta, hoje).fase === fase)
  // A API manda a ida mais recente primeiro; nas próximas, a mais perto vem antes.
  const proximas = daFase('proxima').reverse()

  return (
    <Pagina
      titulo="Viagens"
      acoes={
        <Button asChild variant="secondary">
          <Link to="/viagens/nova">
            <PlusIcon weight="bold" aria-hidden />
            Nova
          </Link>
        </Button>
      }
    >
      {consulta.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando viagens">
          {[1, 2].map((n) => (
            <Skeleton key={n} className="h-20" />
          ))}
        </div>
      ) : consulta.isError ? (
        <EstadoVazio
          icone={AirplaneTiltIcon}
          titulo="Não foi possível carregar as viagens"
          acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
        >
          Verifique a internet e tente de novo.
        </EstadoVazio>
      ) : viagens.length === 0 ? (
        <EstadoVazio
          icone={AirplaneTiltIcon}
          titulo="Nenhuma viagem cadastrada"
          acao={
            <Button asChild>
              <Link to="/viagens/nova">Cadastrar viagem</Link>
            </Button>
          }
        >
          Guarde aqui as datas, a hospedagem, o transporte e as passagens de cada viagem.
        </EstadoVazio>
      ) : (
        <div className="flex flex-col gap-8">
          <Grupo titulo="Em viagem" viagens={daFase('agora')} hoje={hoje} />
          <Grupo titulo="Próximas" viagens={proximas} hoje={hoje} />
          <Grupo titulo="Anteriores" viagens={daFase('passada')} hoje={hoje} />
        </div>
      )}
    </Pagina>
  )
}

function Grupo({ titulo, viagens, hoje }: { titulo: string; viagens: Viagem[]; hoje: string }) {
  if (viagens.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-secao font-bold">{titulo}</h2>
      <ul className="superficie flex flex-col divide-y divide-linha overflow-hidden" aria-label={titulo}>
        {viagens.map((v) => (
          <ItemViagem key={v.id} viagem={v} hoje={hoje} />
        ))}
      </ul>
    </section>
  )
}

function ItemViagem({ viagem: v, hoje }: { viagem: Viagem; hoje: string }) {
  const { fase, texto } = situacaoViagem(v.ida, v.volta, hoje)
  const ida = deDataISO(v.ida)
  return (
    <li>
      <Link to={`/viagens/${v.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-suave/50">
        {/* Canhoto da passagem: dia e mês da ida. Em viagem, na cor cheia da área. */}
        <span
          aria-hidden
          className={cn(
            'flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5 leading-none tabular-nums',
            fase === 'agora' && 'bg-area text-folha',
            fase === 'proxima' && 'bg-area-fundo text-area',
            fase === 'passada' && 'bg-suave text-muted-foreground',
          )}
        >
          <span className="text-destaque font-bold">{ida.day}</span>
          <span className="mt-1 text-sm font-semibold">{ida.toFormat('LLL').replace('.', '')}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cn('leading-snug font-semibold break-words', fase === 'passada' && 'text-muted-foreground')}>
            {v.destino}
          </span>
          <span className="text-apoio text-muted-foreground">{descreverPeriodo(v.ida, v.volta, hoje)}</span>
          {(texto || v.anexos.length > 0) && (
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-apoio">
              {texto && (
                <span className={cn('font-semibold', fase === 'agora' ? 'text-primary' : 'text-area')}>{texto}</span>
              )}
              {v.anexos.length > 0 && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <PaperclipIcon className="size-4" aria-hidden />
                  {contarAnexos(v.anexos.length)}
                </span>
              )}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}
