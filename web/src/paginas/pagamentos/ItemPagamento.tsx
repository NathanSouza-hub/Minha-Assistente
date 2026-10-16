import { useState, type FormEvent } from 'react'
import { CircleAlert, CircleCheck, Paperclip, Repeat } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Campo } from '@/components/Campo'
import { Button } from '@/components/ui/button'
import { useEditarPagamentoPorId, usePagarPagamento } from '@/consultas/pagamentos'
import { dataCurta, descreverVencimento, hojeISO } from '@/lib/datas'
import { formatarCentavos, paraCentavos } from '@/lib/dinheiro'
import type { Pagamento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { paraEdicao } from './formulario'

const textoRecorrencia = { mensal: 'Todo mês', anual: 'Todo ano' } as const

export function ItemPagamento({ pagamento: p }: { pagamento: Pagamento }) {
  const pagar = usePagarPagamento()
  const desfazer = useEditarPagamentoPorId()
  // Conta da equipe com valor a definir: "Pagar…" abre o campo do valor pago.
  const [pedindoValor, setPedindoValor] = useState(false)
  const [valorDigitado, setValorDigitado] = useState('')
  const [erroValor, setErroValor] = useState<string>()
  const aDefinir = p.valorCentavos === null
  const grupo = p.categoriaNome ?? p.cartaoNome ?? (p.membroId ? 'Salários equipe' : null)
  const detalhes = [grupo, p.imovelNome].filter(Boolean).join(', ')
  // Paga hoje e sem comprovante: convida a guardar o comprovante (a fatura abre em Cartões).
  const pedirComprovante =
    p.status === 'pago' && p.dataPagamento === hojeISO() && p.totalComprovantes === 0 && !p.cartaoId
  // A fatura do cartão abre na aba Cartões, no mês dela.
  const endereco = p.cartaoId
    ? `/pagamentos?aba=cartoes&cartao=${p.cartaoId}&mes=${p.competencia!.slice(0, 7)}`
    : `/pagamentos/${p.id}`

  function marcarComoPago(valorCentavos?: number) {
    pagar.mutate(
      { id: p.id, valorCentavos },
      {
        onSuccess: () => {
          setPedindoValor(false)
          toast.success(`${p.descricao} marcado como pago.`, {
            description: p.recorrencia !== 'nenhuma' ? 'A conta do próximo período já foi criada.' : undefined,
            action: p.cartaoId
              ? undefined
              : {
                  label: 'Desfazer',
                  onClick: () =>
                    desfazer.mutate({
                      id: p.id,
                      dados: { ...paraEdicao(p), status: 'pendente', dataPagamento: null },
                    }),
                },
          })
        },
      },
    )
  }

  function confirmarValor(evento: FormEvent) {
    evento.preventDefault()
    const centavos = paraCentavos(valorDigitado)
    if (!centavos) return setErroValor('Digite o valor pago, por exemplo 1.500,00.')
    setErroValor(undefined)
    marcarComoPago(centavos)
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
          {aDefinir ? (
            <span className="shrink-0 rounded-md bg-hoje/25 px-2 font-semibold">A definir</span>
          ) : (
            <span className="shrink-0 text-lg font-bold tabular-nums">{formatarCentavos(p.valorCentavos!)}</span>
          )}
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
          {p.totalComprovantes > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Paperclip className="size-5" aria-hidden />
              {p.totalComprovantes === 1 ? 'Com comprovante' : `${p.totalComprovantes} comprovantes`}
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
      {pedirComprovante && (
        <Button asChild variant="outline" className="w-full sm:w-auto sm:self-start">
          <Link to={`/pagamentos/${p.id}#comprovantes`} aria-label={`Anexar comprovante de ${p.descricao}`}>
            <Paperclip aria-hidden />
            Anexar comprovante
          </Link>
        </Button>
      )}
      {p.status === 'pendente' &&
        (pedindoValor ? (
          <form onSubmit={confirmarValor} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Campo
              rotulo={`Valor pago a ${p.descricao}`}
              prefixo="R$"
              inputMode="decimal"
              placeholder="0,00"
              autoFocus
              value={valorDigitado}
              onChange={(e) => setValorDigitado(e.target.value)}
              erro={erroValor}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={pagar.isPending}>
                <CircleCheck aria-hidden />
                {pagar.isPending ? 'Marcando…' : 'Confirmar pagamento'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPedindoValor(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant={p.vencido ? 'default' : 'outline'}
            onClick={() => (aDefinir ? setPedindoValor(true) : marcarComoPago())}
            disabled={pagar.isPending}
            aria-label={aDefinir ? `Pagar ${p.descricao}` : `Marcar ${p.descricao} como pago`}
            className="w-full sm:w-auto sm:self-start"
          >
            <CircleCheck aria-hidden />
            {pagar.isPending ? 'Marcando…' : aDefinir ? 'Pagar…' : 'Marcar como pago'}
          </Button>
        ))}
    </li>
  )
}
