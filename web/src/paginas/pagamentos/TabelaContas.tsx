import { useState } from 'react'
import { ArrowCounterClockwiseIcon, CheckCircleIcon, PaperclipIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Confirmar } from '@/components/Confirmar'
import { SeloEstado } from '@/components/Estado'
import { Button } from '@/components/ui/button'
import { useExcluirPagamento } from '@/consultas/pagamentos'
import { dataCurta, hojeISO } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Pagamento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { VOLTAR_DESPESAS } from './filtros'
import { useDesfazerPagamento, useMarcarComoPago } from './marcarComoPago'
import { PagarComValor } from './PagarComValor'

// Colunas que só aparecem em tela larga; no celular a linha mostra descrição, valor, vencimento
// e o botão de pagar; em tela larga ganha as outras colunas e editar/excluir (tocar na descrição abre a conta, onde ficam editar e excluir).
const soLargo = 'hidden lg:table-cell'
const textoFixo = { nenhuma: 'Não', mensal: 'Sim', anual: 'Todo ano' } as const

// A conta da equipe se repete pelos dias de pagamento da pessoa; parcela e fatura não são "fixas".
const fixoDe = (p: Pagamento) =>
  p.membroId ? 'Sim' : p.parcelaTotal || p.cartaoId ? '–' : textoFixo[p.recorrencia]

const grupoDe = (p: Pagamento) => p.categoriaNome ?? p.cartaoNome ?? (p.membroId ? 'Salários equipe' : '')

/** A fatura do cartão abre na aba Cartões, no mês dela; as outras contas, na tela da conta (que volta
 * para a Lista de despesas, ou para a aba do Cadastro de despesas quando `voltar` é vazio). */
const enderecoDe = (p: Pagamento, voltar: string, ancora = '') =>
  p.cartaoId
    ? `/pagamentos?aba=cartoes&cartao=${p.cartaoId}&mes=${p.competencia!.slice(0, 7)}`
    : `/pagamentos/${p.id}${voltar ? `?voltar=${voltar}` : ''}${ancora}`

/** Contas do mês em tabela: contas comuns, faturas dos cartões e pagamentos da equipe. */
export function TabelaContas({
  pagamentos,
  rotulo,
  voltar = VOLTAR_DESPESAS,
}: {
  pagamentos: Pagamento[]
  rotulo: string
  voltar?: string
}) {
  return (
    <div className="superficie overflow-x-auto">
      <table className="w-full border-collapse text-left" aria-label={rotulo}>
        <thead className="bg-suave text-[0.88rem] text-muted-foreground">
          <tr>
            <th scope="col" className="px-2.5 py-2 font-semibold">
              Descrição
            </th>
            <th scope="col" className="px-2.5 py-2 text-right font-semibold">
              Valor
            </th>
            <th scope="col" className="hidden px-2.5 py-2 font-semibold sm:table-cell">
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
            <LinhaConta key={p.id} pagamento={p} voltar={voltar} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LinhaConta({ pagamento: p, voltar }: { pagamento: Pagamento; voltar: string }) {
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
    <tr className="border-t border-linha align-middle">
      <td className="px-2.5 py-2">
        <Link to={enderecoDe(p, voltar)} className="-mx-1 flex flex-col rounded-md px-1 py-1 hover:bg-suave/70">
          <span className="flex items-center gap-1.5 leading-snug font-semibold">
            {p.descricao}
            {p.totalComprovantes > 0 && (
              <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Com comprovante" role="img" />
            )}
          </span>
          {/* No celular as colunas escondidas viram uma linha de detalhes. */}
          <span className="text-[0.88rem] text-muted-foreground lg:hidden" aria-hidden>
            {[grupo, parcela, p.status === 'pago' ? 'Pago' : null].filter(Boolean).join(' · ')}
          </span>
        </Link>
      </td>
      <td className="px-2.5 py-2 text-right whitespace-nowrap tabular-nums">
        {aDefinir ? (
          <SeloEstado estado="a_definir">A definir</SeloEstado>
        ) : (
          <span className="font-bold">{formatarCentavos(p.valorCentavos!)}</span>
        )}
        {/* No celular estreito a data vem embaixo do valor (sem a coluna de vencimento). */}
        <span className={cn('block text-[0.88rem] sm:hidden', p.vencido ? 'font-semibold text-atraso' : 'text-muted-foreground')} aria-hidden>
          {dataCurta(p.vencimento).slice(0, 5)}
        </span>
      </td>
      <td className={cn('hidden px-2.5 py-2 whitespace-nowrap tabular-nums sm:table-cell', p.vencido && 'font-semibold text-atraso')}>
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
            <SeloEstado estado="feito">Pago</SeloEstado>
            <span className="text-sm text-muted-foreground">em {dataCurta(p.dataPagamento!)}</span>
          </span>
        ) : p.vencido ? (
          <SeloEstado estado="vencido">Atrasada</SeloEstado>
        ) : p.vencimento === hojeISO() ? (
          <SeloEstado estado="vence_hoje" />
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
              className="text-ok"
              disabled={marcando}
              onClick={() => (aDefinir ? setPedindoValor(true) : marcar(p))}
              aria-label={aDefinir ? `Pagar ${p.descricao}` : `Marcar ${p.descricao} como pago`}
              title="Marcar como pago"
            >
              <CheckCircleIcon className="size-7" aria-hidden />
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
                <ArrowCounterClockwiseIcon className="size-6" aria-hidden />
              </Button>
            )
          )}
          {pedirComprovante && (
            <Button asChild variant="ghost" size="icon" title="Anexar comprovante">
              <Link to={enderecoDe(p, voltar, '#comprovantes')} aria-label={`Anexar comprovante de ${p.descricao}`}>
                <PaperclipIcon className="size-6" aria-hidden />
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="icon" className="hidden lg:inline-flex" title="Editar">
            <Link to={enderecoDe(p, voltar)} aria-label={`Editar ${p.descricao}`}>
              <PencilSimpleIcon className="size-5" aria-hidden />
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
                  <TrashIcon className="size-5" aria-hidden />
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
