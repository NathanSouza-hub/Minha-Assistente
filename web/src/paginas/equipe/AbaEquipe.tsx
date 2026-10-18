import { CaretRightIcon, PlusIcon, UsersIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEquipe } from '@/consultas/equipe'
import { usePagamentos } from '@/consultas/pagamentos'
import { intervaloDoMes, nomeDoMes } from '@/lib/datas'
import type { FormaPagamento, MembroEquipe } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { ItemPagamento } from '@/paginas/pagamentos/ItemPagamento'
import { NavegadorMes, ResumoContas } from '@/paginas/pagamentos/ResumoContas'

const textoForma: Record<FormaPagamento, string> = {
  mensal: 'Por mês',
  plantao: 'Plantão',
  honorario: 'Honorário',
}

// "dia 5" / "dias 5 e 20" / "dias 1, 10 e 20"
function descreverDias(dias: MembroEquipe['dias']) {
  const numeros = dias.map((d) => d.dia)
  if (numeros.length === 1) return `dia ${numeros[0]}`
  return `dias ${numeros.slice(0, -1).join(', ')} e ${numeros.at(-1)}`
}

function ListaEquipe() {
  const { data: equipe, isPending } = useEquipe()

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-equipe">
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-equipe" className="text-xl font-bold">
          Equipe
        </h2>
        <Button asChild variant="outline">
          <Link to="/equipe/novo">
            <PlusIcon weight="bold" aria-hidden />
            Adicionar pessoa
          </Link>
        </Button>
      </div>
      {isPending ? (
        <Skeleton className="h-20" role="status" aria-label="Carregando equipe" />
      ) : !equipe?.length ? (
        <EstadoVazio icone={UsersIcon} titulo="Ninguém na equipe ainda">
          Cadastre quem recebe salário, plantão ou honorário. O app cria as contas nos dias de pagamento.
        </EstadoVazio>
      ) : (
        <ul className="flex flex-col divide-y divide-linha" aria-label="Pessoas da equipe">
          {equipe.map((m) => (
            <li key={m.id}>
              <Link
                to={`/equipe/${m.id}`}
                className="-mx-2 my-1 flex items-center gap-4 rounded-lg px-2 py-3 hover:bg-areia/70"
              >
                {/* Inicial do nome no selo da área, como um crachá. */}
                <span
                  aria-hidden
                  className={cn('selo-area size-11 text-lg font-bold', !m.ativo && 'bg-areia text-muted-foreground')}
                >
                  {m.nome.trim().charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 text-lg leading-snug font-bold">
                    <span className={cn(!m.ativo && 'text-muted-foreground')}>{m.nome}</span>
                    {!m.ativo && (
                      <span className="rounded-full bg-areia px-2.5 text-base font-semibold text-muted-foreground">
                        Inativa
                      </span>
                    )}
                  </span>
                  <span className="text-base text-muted-foreground">
                    {[m.funcao, textoForma[m.formaPagamento], descreverDias(m.dias)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <CaretRightIcon weight="bold" className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Aba "Salários equipe" de Contas: os pagamentos da equipe no mês e o cadastro das pessoas. */
export function AbaEquipe({ mes, aoMudarMes }: { mes: string; aoMudarMes: (mes: string) => void }) {
  // A API não filtra por pessoa: busca o mês e fica com as contas da equipe.
  const consulta = usePagamentos(intervaloDoMes(mes))
  const pagamentos = (consulta.data ?? []).filter((p) => p.membroId)

  return (
    <div className="flex flex-col gap-5">
      <NavegadorMes mes={mes} aoMudar={aoMudarMes} />
      {pagamentos.length > 0 && <ResumoContas pagamentos={pagamentos} />}

      {consulta.isPending ? (
        <Skeleton className="h-36" role="status" aria-label="Carregando pagamentos da equipe" />
      ) : pagamentos.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-linha p-4 text-center text-muted-foreground">
          Nenhum pagamento da equipe em {nomeDoMes(mes).toLowerCase()}.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-linha" aria-label="Pagamentos da equipe do mês">
          {pagamentos.map((p) => (
            <ItemPagamento key={p.id} pagamento={p} />
          ))}
        </ul>
      )}

      <ListaEquipe />
    </div>
  )
}
