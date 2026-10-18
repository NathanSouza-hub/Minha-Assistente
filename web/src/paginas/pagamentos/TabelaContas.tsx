import { useState, type FormEvent } from 'react'
import { CircleCheck, Paperclip, Pencil, Trash2, Undo2 } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useExcluirPagamento } from '@/consultas/pagamentos'
import { dataCurta, hojeISO } from '@/lib/datas'
import { formatarCentavos, paraCentavos } from '@/lib/dinheiro'
import type { Pagamento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { VOLTAR_DESPESAS } from './filtros'
import { useDesfazerPagamento, useMarcarComoPago } from './marcarComoPago'

// Colunas que só aparecem em tela larga; no celular a linha mostra descrição, valor, vencimento
// e o botão de pagar; em tela larga ganha as outras colunas e editar/excluir (tocar na descrição abre a conta, onde ficam editar e excluir).
const soLargo = 'hidden lg:table-cell'
const textoFixo = { nenhuma: 'Não', mensal: 'Sim', anual: 'Todo ano' } as const

// A conta da equipe se repete pelos dias de pagamento da pessoa; parcela e fatura não são "fixas".
const fixoDe = (p: Pagamento) =>
  p.membroId ? 'Sim' : p.parcelaTotal || p.cartaoId ? '–' : textoFixo[p.recorrencia]

const grupoDe = (p: Pagamento) => p.categoriaNome ?? p.cartaoNome ?? (p.membroId ? 'Salários equipe' : '')

/** A fatura do cartão abre na aba Cartões, no mês dela; as outras contas, na tela da conta (que volta
 * para a Lista de despesas). */
const enderecoDe = (p: Pagamento, ancora = '') =>
  p.cartaoId
    ? `/pagamentos?aba=cartoes&cartao=${p.cartaoId}&mes=${p.competencia!.slice(0, 7)}`
    : `/pagamentos/${p.id}?voltar=${VOLTAR_DESPESAS}${ancora}`

/** Contas do mês em tabela: contas comuns, faturas dos cartões e pagamentos da equipe. */
export function TabelaContas({ pagamentos, rotulo }: { pagamentos: Pagamento[]; rotulo: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full border-collapse text-left" aria-label={rotulo}>
        <thead className="bg-muted/60 text-base text-muted-foreground">
          <tr>
            <th scope="col" className="px-2.5 py-2 font-semibold">
              Descrição
            </th>
            <th scope="col" className="px-2.5 py-2 text-right font-semibold">
              Valor
            </th>
            <th scope="col" className="px-2.5 py-2 font-semibold">
              Vencimento
            </th>
            <th scope="col" className={cn(soLargo, 'px-2.5 py-2 font-semibold')}>
              Parcelas
            </th>
            <th scope="col" className={cn(soLargo, 'px-2.5 py-2 font-semibold')}>
              Fixo
            </th>
            <th scope="col" className={cn(soLargo, 'px-2.5 py-2 font-semibold')}>
              Categoria
            </th>
            <th scope="col" className={cn(soLargo, 'px-2.5 py-2 font-semibold')}>
              Status
            </th>
            <th scope="col" className="px-2.5 py-2 text-right font-semibold">
              <span className="sr-only lg:not-sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pagamentos.map((p) => (
            <LinhaConta key={p.id} pagamento={p} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LinhaConta({ pagamento: p }: { pagamento: Pagamento }) {
  const { marcar, marcando } = useMarcarComoPago()
  const { desfazer, desfazendo } = useDesfazerPagamento()
  const excluir = useExcluirPagamento()
  const [pedindoValor, setPedindoValor] = useState(false)
  const aDefinir = p.valorCentavos === null
  const fatura = Boolean(p.cartaoId)
  const grupo = [grupoDe(p), p.imovelNome].filter(Boolean).join(', ')
  const parcela = p.parcelaTotal ? `${p.parcelaAtual}/${p.parcelaTotal}` : null
  // Paga hoje e sem comprovante: convida a guardar o comprovante (a fatura abre em Cartões).
  const pedirComprovante = p.status === 'pago' && p.dataPagamento === hojeISO() && p.totalComprovantes === 0 && !fatura

  function remover() {
    // mutateAsync: a linha sai do cache antes do fim e desmonta, e o onSuccess do mutate não rodaria.
    // O erro já vira aviso em src/app/consultas.ts.
    excluir.mutateAsync(p.id).then(
      () => toast.success(`${p.descricao} excluído.`),
      () => {},
    )
  }

  return (
    <tr className="border-t align-middle">
      <td className="px-2.5 py-2">
        <Link to={enderecoDe(p)} className="-mx-1 flex flex-col rounded-md px-1 py-1 hover:bg-muted/60">
          <span className="flex items-center gap-1.5 leading-snug font-bold">
            {p.descricao}
            {p.totalComprovantes > 0 && (
              <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-label="Com comprovante" role="img" />
            )}
          </span>
          {/* No celular as colunas escondidas viram uma linha de detalhes. */}
          <span className="text-base text-muted-foreground lg:hidden" aria-hidden>
            {[grupo, parcela, p.status === 'pago' ? 'Pago' : null].filter(Boolean).join(' · ')}
          </span>
        </Link>
      </td>
      <td className="px-2.5 py-2 text-right whitespace-nowrap tabular-nums">
        {aDefinir ? (
          <span className="rounded-md bg-hoje/25 px-2 font-semibold">A definir</span>
        ) : (
          <span className="font-bold">{formatarCentavos(p.valorCentavos!)}</span>
        )}
      </td>
      <td className={cn('px-2.5 py-2 whitespace-nowrap tabular-nums', p.vencido && 'font-semibold text-atraso')}>
        {/* No celular sem o ano, para sobrar espaço para a descrição. */}
        <span className="lg:hidden">{dataCurta(p.vencimento).slice(0, 5)}</span>
        <span className="hidden lg:inline">{dataCurta(p.vencimento)}</span>
        {p.vencido && <span className="sr-only"> (vencida)</span>}
      </td>
      <td className={cn(soLargo, 'px-2.5 py-2 tabular-nums')}>
        {parcela ? <span aria-label={`parcela ${p.parcelaAtual} de ${p.parcelaTotal}`}>{parcela}</span> : '–'}
      </td>
      <td className={cn(soLargo, 'px-2.5 py-2')}>{fixoDe(p)}</td>
      <td className={cn(soLargo, 'px-2.5 py-2')}>{grupo || '–'}</td>
      <td className={cn(soLargo, 'px-2.5 py-2 whitespace-nowrap')}>
        {p.status === 'pago' ? (
          <span className="flex flex-col">
            <span className="font-semibold text-primary">Pago</span>
            <span className="text-sm text-muted-foreground">em {dataCurta(p.dataPagamento!)}</span>
          </span>
        ) : p.vencido ? (
          <span className="font-semibold text-atraso">Atrasada</span>
        ) : (
          <span className="font-semibold">Pendente</span>
        )}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center justify-end gap-1">
          {p.status === 'pendente' ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-primary"
              disabled={marcando}
              onClick={() => (aDefinir ? setPedindoValor(true) : marcar(p))}
              aria-label={aDefinir ? `Pagar ${p.descricao}` : `Marcar ${p.descricao} como pago`}
              title="Marcar como pago"
            >
              <CircleCheck className="size-6" aria-hidden />
            </Button>
          ) : (
            !fatura && (
              <Button
                variant="ghost"
                size="icon"
                disabled={desfazendo}
                onClick={() => desfazer(p)}
                aria-label={`Desfazer pagamento de ${p.descricao}`}
                title="Desfazer pagamento"
              >
                <Undo2 className="size-6" aria-hidden />
              </Button>
            )
          )}
          {pedirComprovante && (
            <Button asChild variant="ghost" size="icon" title="Anexar comprovante">
              <Link to={enderecoDe(p, '#comprovantes')} aria-label={`Anexar comprovante de ${p.descricao}`}>
                <Paperclip className="size-6" aria-hidden />
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="icon" className="hidden lg:inline-flex" title="Editar">
            <Link to={enderecoDe(p)} aria-label={`Editar ${p.descricao}`}>
              <Pencil className="size-5" aria-hidden />
            </Link>
          </Button>
          {!fatura && (
            <Confirmar
              gatilho={
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden text-destructive lg:inline-flex"
                  aria-label={`Excluir ${p.descricao}`}
                  title="Excluir"
                >
                  <Trash2 className="size-5" aria-hidden />
                </Button>
              }
              titulo="Excluir esta conta?"
              descricao={
                parcela
                  ? 'Só esta parcela será excluída. As outras continuam.'
                  : `${p.descricao}${aDefinir ? '' : ` de ${formatarCentavos(p.valorCentavos!)}`} será apagado e não dá para desfazer.`
              }
              confirmar="Excluir conta"
              aoConfirmar={remover}
            />
          )}
        </div>
        {pedindoValor && (
          <PagarComValor
            pagamento={p}
            enviando={marcando}
            aoConfirmar={(centavos) => marcar(p, centavos, () => setPedindoValor(false))}
            aoFechar={() => setPedindoValor(false)}
          />
        )}
      </td>
    </tr>
  )
}

/** Conta da equipe com valor a definir: pede o valor pago antes de marcar. */
function PagarComValor({
  pagamento: p,
  enviando,
  aoConfirmar,
  aoFechar,
}: {
  pagamento: Pagamento
  enviando: boolean
  aoConfirmar: (centavos: number) => void
  aoFechar: () => void
}) {
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState<string>()

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const centavos = paraCentavos(valor)
    if (!centavos) return setErro('Digite o valor pago, por exemplo 1.500,00.')
    setErro(undefined)
    aoConfirmar(centavos)
  }

  return (
    <AlertDialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pagar {p.descricao}</AlertDialogTitle>
          <AlertDialogDescription>Informe quanto foi pago.</AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Campo
            rotulo={`Valor pago a ${p.descricao}`}
            prefixo="R$"
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            erro={erro}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Voltar
            </Button>
            <Button type="submit" disabled={enviando}>
              <CircleCheck aria-hidden />
              {enviando ? 'Marcando…' : 'Confirmar pagamento'}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
