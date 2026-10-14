import { Paperclip, Plane, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useViagens } from '@/consultas/viagens'
import { hojeISO } from '@/lib/datas'
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
        <Button asChild size="lg">
          <Link to="/viagens/nova">
            <Plus aria-hidden />
            Nova
          </Link>
        </Button>
      }
    >
      {consulta.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando viagens">
          {[1, 2].map((n) => (
            <Skeleton key={n} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : consulta.isError ? (
        <EstadoVazio
          icone={Plane}
          titulo="Não foi possível carregar as viagens"
          acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
        >
          Verifique a internet e tente de novo.
        </EstadoVazio>
      ) : viagens.length === 0 ? (
        <EstadoVazio
          icone={Plane}
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
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{titulo}</h2>
      <ul className="flex flex-col gap-3" aria-label={titulo}>
        {viagens.map((v) => (
          <ItemViagem key={v.id} viagem={v} hoje={hoje} />
        ))}
      </ul>
    </section>
  )
}

function ItemViagem({ viagem: v, hoje }: { viagem: Viagem; hoje: string }) {
  const { fase, texto } = situacaoViagem(v.ida, v.volta, hoje)
  return (
    <li>
      <Link
        to={`/viagens/${v.id}`}
        className={cn(
          'flex flex-col gap-1 rounded-xl border bg-card p-4 hover:bg-muted/60',
          fase === 'agora' && 'border-l-4 border-l-hoje',
          fase === 'passada' && 'text-muted-foreground',
        )}
      >
        <span className="text-lg leading-snug font-bold">{v.destino}</span>
        <span className="text-base">{descreverPeriodo(v.ida, v.volta, hoje)}</span>
        {(texto || v.anexos.length > 0) && (
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base">
            {texto && <span className="font-semibold text-primary">{texto}</span>}
            {v.anexos.length > 0 && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Paperclip className="size-5" aria-hidden />
                {contarAnexos(v.anexos.length)}
              </span>
            )}
          </span>
        )}
      </Link>
    </li>
  )
}
