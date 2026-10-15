import { CircleAlert, CircleCheck, Repeat } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useEditarPagamentoPorId, usePagarPagamento } from '@/consultas/pagamentos'
import { dataCurta, descreverVencimento } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Pagamento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { paraEdicao } from './formulario'

const textoRecorrencia = { mensal: 'Todo mês', anual: 'Todo ano' } as const

export function ItemPagamento({ pagamento: p }: { pagamento: Pagamento }) {
  const pagar = usePagarPagamento()
  const desfazer = useEditarPagamentoPorId()
  const detalhes = [p.categoriaNome ?? p.cartaoNome, p.imovelNome].filter(Boolean).join(', ')
  // A fatura do cartão abre na aba Cartões, no mês dela.
  const endereco = p.cartaoId
    ? `/pagamentos?aba=cartoes&cartao=${p.cartaoId}&mes=${p.competencia!.slice(0, 7)}`
    : `/pagamentos/${p.id}`

  function marcarComoPago() {
    pagar.mutate(p.id, {
      onSuccess: () =>
        toast.success(`${p.descricao} marcado como pago.`, {
          description: p.recorrencia !== 'nenhuma' ? 'A conta do próximo período já foi criada.' : undefined,
          action: p.cartaoId
            ? undefined
            : {
                label: 'Desfazer',
                onClick: () =>
                  desfazer.mutate({ id: p.id, dados: { ...paraEdicao(p), status: 'pendente', dataPagamento: null } }),
              },
        }),
    })
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-4',
        p.vencido && 'border-l-4 border-l-atraso',
      )}
    >
      <Link to={endereco} className="-m-1 flex flex-col gap-1 rounded-lg p-1 hover:bg-muted/60">
        <span className="flex items-start justify-between gap-3">
          <span className="text-lg leading-snug font-bold">{p.descricao}</span>
          <span className="shrink-0 text-lg font-bold tabular-nums">{formatarCentavos(p.valorCentavos)}</span>
        </span>
        <span className="text-base text-muted-foreground">{detalhes}</span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base">
          {p.status === 'pago' ? (
            <span className="flex items-center gap-1.5 font-semibold text-primary">
              <CircleCheck className="size-5" aria-hidden />
              Pago em {dataCurta(p.dataPagamento!)}
            </span>
          ) : (
            <span className={cn('flex items-center gap-1.5 font-semibold', p.vencido && 'text-atraso')}>
              {p.vencido && <CircleAlert className="size-5" aria-hidden />}
              {descreverVencimento(p.vencimento)}
            </span>
          )}
          {p.parcelaTotal && (
            <span
              className="rounded-md bg-muted px-2 font-semibold tabular-nums"
              aria-label={`parcela ${p.parcelaAtual} de ${p.parcelaTotal}`}
            >
              {p.parcelaAtual}/{p.parcelaTotal}
            </span>
          )}
          {p.recorrencia !== 'nenhuma' && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Repeat className="size-5" aria-hidden />
              {textoRecorrencia[p.recorrencia]}
            </span>
          )}
        </span>
      </Link>
      {p.status === 'pendente' && (
        <Button
          variant={p.vencido ? 'default' : 'outline'}
          onClick={marcarComoPago}
          disabled={pagar.isPending}
          aria-label={`Marcar ${p.descricao} como pago`}
          className="w-full sm:w-auto sm:self-start"
        >
          <CircleCheck aria-hidden />
          {pagar.isPending ? 'Marcando…' : 'Marcar como pago'}
        </Button>
      )}
    </li>
  )
}
