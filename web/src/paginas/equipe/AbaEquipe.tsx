import { CaretRightIcon, PlusIcon, UsersIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Abas } from '@/components/Abas'
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

/** Botão do cabeçalho da Equipe (fica no `acoes` da página). */
export function BotaoAdicionarPessoa() {
  return (
    <Button asChild variant="secondary">
      <Link to="/equipe/novo">
        <PlusIcon weight="bold" aria-hidden />
        Adicionar pessoa
      </Link>
    </Button>
  )
}

/** As pessoas em cartões: crachá com a inicial, função, forma e dias de pagamento. */
function ListaEquipe() {
  const { data: equipe, isPending } = useEquipe()

  if (isPending) return <Skeleton className="h-20" role="status" aria-label="Carregando equipe" />
  if (!equipe?.length)
    return (
      <EstadoVazio icone={UsersIcon} titulo="Ninguém na equipe ainda">
        Cadastre quem recebe salário, plantão ou honorário. O app cria as contas nos dias de pagamento.
      </EstadoVazio>
    )
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Integrantes da equipe">
      {equipe.map((m) => (
        <li key={m.id}>
          <Link
            to={`/equipe/${m.id}`}
            className="superficie flex h-full items-center gap-4 p-4 hover:bg-suave/40"
          >
            <span
              aria-hidden
              className={cn('selo-area size-12 text-lg font-bold', !m.ativo && 'bg-suave text-muted-foreground')}
            >
              {m.nome.trim().charAt(0).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-x-2 leading-snug font-semibold">
                <span className={cn(!m.ativo && 'text-muted-foreground')}>{m.nome}</span>
                {!m.ativo && (
                  <span className="rounded-full bg-suave px-2.5 text-base font-semibold text-muted-foreground">
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
  )
}

/** Os pagamentos da equipe no mês, com o resumo (a pagar, vencidas, pago) em cima. */
function PagamentosDoMes({ mes, aoMudarMes }: { mes: string; aoMudarMes: (mes: string) => void }) {
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
        <ul
          className="superficie flex flex-col divide-y divide-linha overflow-hidden"
          aria-label="Pagamentos da equipe do mês"
        >
          {pagamentos.map((p) => (
            <ItemPagamento key={p.id} pagamento={p} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Grupo "Salários equipe" do Cadastro de despesas: os pagamentos do mês e, em outra aba, os integrantes. */
export function AbaEquipe({ mes, aoMudarMes }: { mes: string; aoMudarMes: (mes: string) => void }) {
  // Busca já aqui: conta as pessoas na aba e deixa a equipe em cache para a conta aberta (chave PIX).
  const { data: equipe } = useEquipe()
  return (
    <Abas<'pagamentos' | 'integrantes'>
      rotulo="Partes da Equipe"
      abas={[
        {
          valor: 'pagamentos',
          rotulo: 'Pagamentos do mês',
          conteudo: <PagamentosDoMes mes={mes} aoMudarMes={aoMudarMes} />,
        },
        { valor: 'integrantes', rotulo: 'Integrantes', contador: equipe?.length, conteudo: <ListaEquipe /> },
      ]}
    />
  )
}
