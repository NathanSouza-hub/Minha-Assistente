import { CaretLeftIcon, CaretRightIcon, CheckCircleIcon, CreditCardIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCartoes, useFatura, usePagarFatura } from '@/consultas/cartoes'
import { dataCurta, deDataISO, nomeDoMes, somarMeses } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Cartao, SituacaoFatura } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { FUNDOS } from './formulario'

const textoSituacao: Record<SituacaoFatura, string> = { aberta: 'Aberta', fechada: 'Fechada', paga: 'Paga' }

// "10/nov"
const diaMes = (data: string) => deDataISO(data).setLocale('pt-BR').toFormat('dd/LLL').replace('.', '')

function CartaoDesenhado({
  cartao: c,
  selecionado,
  aoEscolher,
}: {
  cartao: Cartao
  selecionado: boolean
  aoEscolher: () => void
}) {
  const usado =
    c.limiteCentavos && c.limiteDisponivelCentavos !== null
      ? Math.min(100, Math.max(0, ((c.limiteCentavos - c.limiteDisponivelCentavos) / c.limiteCentavos) * 100))
      : null

  return (
    <button
      type="button"
      aria-pressed={selecionado}
      onClick={aoEscolher}
      className={cn(
        'flex aspect-[1.586] w-64 flex-col justify-between rounded-2xl bg-linear-to-br p-4 text-left text-white shadow-md transition-opacity',
        FUNDOS[c.cor],
        selecionado ? 'ring-4 ring-hoje ring-offset-2 ring-offset-background' : 'opacity-75 hover:opacity-100',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-lg leading-tight font-bold">{c.nome}</span>
        <CreditCardIcon className="size-6 shrink-0 opacity-80" aria-hidden />
      </span>
      {c.final && (
        <span className="font-mono text-base tracking-widest" aria-label={`final ${c.final}`}>
          •••• {c.final}
        </span>
      )}
      <span className="flex flex-col gap-1.5">
        <span className="flex items-end justify-between gap-2">
          <span className="flex flex-col">
            <span className="text-sm opacity-80">Fatura</span>
            <span className="text-xl font-bold tabular-nums">{formatarCentavos(c.faturaAtual.totalCentavos)}</span>
          </span>
          <span className="text-sm">vence {diaMes(c.faturaAtual.vencimento)}</span>
        </span>
        {usado !== null && (
          <span className="h-1.5 overflow-hidden rounded-full bg-white/30" aria-hidden>
            <span className="block h-full rounded-full bg-white" style={{ width: `${usado}%` }} />
          </span>
        )}
      </span>
    </button>
  )
}

/** Fatura do cartão escolhido no mês da URL (padrão: a fatura atual dele). */
function FaturaDoMes({ cartao, mes, aoMudarMes }: { cartao: Cartao; mes: string; aoMudarMes: (mes: string) => void }) {
  const consulta = useFatura(cartao.id, mes)
  const pagar = usePagarFatura()
  const fatura = consulta.data

  function pagarFatura() {
    if (!fatura?.pagamentoId) return
    pagar.mutate(fatura.pagamentoId, {
      onSuccess: () => toast.success(`Fatura de ${nomeDoMes(mes).toLowerCase()} paga.`),
    })
  }

  return (
    <section className="flex flex-col gap-4" aria-label={`Fatura do ${cartao.nome}`}>
      <nav aria-label="Mês da fatura" className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" onClick={() => aoMudarMes(somarMeses(mes, -1))} aria-label="Fatura anterior">
          <CaretLeftIcon weight="bold" className="size-7" aria-hidden />
        </Button>
        <h2 className="text-xl font-bold" aria-live="polite">
          {nomeDoMes(mes)}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => aoMudarMes(somarMeses(mes, 1))} aria-label="Próxima fatura">
          <CaretRightIcon weight="bold" className="size-7" aria-hidden />
        </Button>
      </nav>

      {!fatura ? (
        <Skeleton className="h-32" role="status" aria-label="Carregando fatura" />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl bg-folha p-4 shadow-folha">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-base text-muted-foreground">Total da fatura</span>
                <span className="text-3xl font-bold tabular-nums">{formatarCentavos(fatura.totalCentavos)}</span>
              </div>
              <span
                className={cn(
                  'rounded-full px-3 py-1 font-semibold',
                  fatura.situacao === 'paga' && 'bg-ok-fundo text-ok',
                  fatura.situacao === 'fechada' && 'bg-terracota-clara text-terracota',
                  fatura.situacao === 'aberta' && 'bg-areia',
                )}
              >
                {textoSituacao[fatura.situacao]}
              </span>
            </div>
            <p className="text-base text-muted-foreground">
              Fecha em {dataCurta(fatura.fechamento)} · vence em {dataCurta(fatura.vencimento)}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {fatura.situacao === 'fechada' && fatura.pagamentoId && (
                <Button onClick={pagarFatura} disabled={pagar.isPending}>
                  <CheckCircleIcon aria-hidden />
                  {pagar.isPending ? 'Pagando…' : 'Pagar fatura'}
                </Button>
              )}
              <Button asChild variant={fatura.situacao === 'fechada' ? 'outline' : 'default'}>
                <Link to={`/cartoes/${cartao.id}/compras/nova?mes=${mes}`}>
                  <PlusIcon weight="bold" aria-hidden />
                  Adicionar compra
                </Link>
              </Button>
            </div>
          </div>

          {fatura.parcelas.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-linha p-4 text-center text-muted-foreground">
              Nenhuma compra nesta fatura.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-linha" aria-label="Compras da fatura">
              {fatura.parcelas.map((p) => (
                <li key={`${p.compraId}-${p.parcela}`}>
                  <Link
                    to={`/cartoes/${cartao.id}/compras/${p.compraId}`}
                    className="-mx-2 my-1 flex items-start justify-between gap-3 rounded-lg px-2 py-3 hover:bg-areia/70"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-lg leading-snug font-bold">{p.descricao}</span>
                      <span className="text-base text-muted-foreground">
                        {[dataCurta(p.dataCompra), p.categoriaNome].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-lg font-bold tabular-nums">{formatarCentavos(p.valorCentavos)}</span>
                      {p.totalParcelas > 1 && (
                        <span
                          className="rounded-full bg-areia px-2.5 font-semibold tabular-nums"
                          aria-label={`parcela ${p.parcela} de ${p.totalParcelas}`}
                        >
                          {p.parcela}/{p.totalParcelas}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Button asChild variant="ghost" className="self-start">
        <Link to={`/cartoes/${cartao.id}`}>
          <PencilSimpleIcon aria-hidden />
          Editar cartão
        </Link>
      </Button>
    </section>
  )
}

/** Aba "Cartões" de Contas: carrossel de cartões e a fatura do mês do escolhido. */
export function AbaCartoes() {
  const [params, setParams] = useSearchParams()
  const consulta = useCartoes()
  const cartoes = consulta.data ?? []
  const escolhido = cartoes.find((c) => c.id === params.get('cartao')) ?? cartoes[0]
  const mesDaUrl = params.get('mes') ?? ''
  const mes = /^\d{4}-\d{2}$/.test(mesDaUrl) ? mesDaUrl : (escolhido?.faturaAtual.competencia.slice(0, 7) ?? '')

  const mudar = (mudancas: Record<string, string>) =>
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual)
        for (const [chave, valor] of Object.entries(mudancas)) {
          if (valor) novo.set(chave, valor)
          else novo.delete(chave)
        }
        return novo
      },
      { replace: true },
    )

  if (consulta.isPending) {
    return <Skeleton className="aspect-[1.586] w-64 rounded-2xl" role="status" aria-label="Carregando cartões" />
  }
  if (consulta.isError) {
    return (
      <EstadoVazio
        icone={CreditCardIcon}
        titulo="Não foi possível carregar os cartões"
        acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
      >
        Verifique a internet e tente de novo.
      </EstadoVazio>
    )
  }
  if (!escolhido) {
    return (
      <EstadoVazio
        icone={CreditCardIcon}
        titulo="Nenhum cartão cadastrado"
        acao={
          <Button asChild>
            <Link to="/cartoes/novo">Adicionar cartão</Link>
          </Button>
        }
      >
        Cadastre o cartão de crédito para lançar as compras. A fatura de cada mês vira uma conta a pagar.
      </EstadoVazio>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 pt-1 pb-3 md:-mx-8 md:px-8">
        <ul className="flex w-max gap-3" aria-label="Cartões">
          {cartoes.map((c) => (
            <li key={c.id} className="snap-start p-1">
              <CartaoDesenhado
                cartao={c}
                selecionado={c.id === escolhido.id}
                // Outro cartão abre na fatura atual dele.
                aoEscolher={() => mudar({ cartao: c.id, mes: '' })}
              />
            </li>
          ))}
          <li className="snap-start p-1">
            <Link
              to="/cartoes/novo"
              className="flex aspect-[1.586] w-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input font-semibold text-area hover:bg-areia"
            >
              <PlusIcon weight="bold" className="size-7" aria-hidden />
              Novo cartão
            </Link>
          </li>
        </ul>
      </div>
      <FaturaDoMes cartao={escolhido} mes={mes} aoMudarMes={(novo) => mudar({ cartao: escolhido.id, mes: novo })} />
    </div>
  )
}
