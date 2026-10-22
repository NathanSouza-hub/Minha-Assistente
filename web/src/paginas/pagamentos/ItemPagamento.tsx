import { useState } from 'react'
import { ArrowRightIcon, PaperclipIcon, RepeatIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { SeloEstado } from '@/components/Estado'
import { LinhaMarcavel, MenuLinha, type AcaoLinha } from '@/components/Linha'
import { dataCurta, descreverVencimento, hojeISO } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Pagamento } from '@/lib/tipos'
import { useDesfazerPagamento, useMarcarComoPago } from './marcarComoPago'
import { PagarComValor } from './PagarComValor'

const textoRecorrencia = { mensal: 'Todo mês', anual: 'Todo ano' } as const

/** Situação da conta em uma palavra, com o estado padronizado (pago, vencido, vence hoje ou a data). */
export function SituacaoConta({ p }: { p: Pagamento }) {
  if (p.status === 'pago') return <SeloEstado estado="feito">Pago em {dataCurta(p.dataPagamento!)}</SeloEstado>
  const texto = descreverVencimento(p.vencimento)
  if (p.vencido) return <SeloEstado estado="vencido">{texto}</SeloEstado>
  if (p.vencimento === hojeISO()) return <SeloEstado estado="vence_hoje" />
  return <span>{texto}</span>
}

/**
 * Uma conta em lista (Contas a pagar, Equipe, Residências), no molde do Início: o círculo paga (ou
 * desfaz), o texto abre a conta, o valor à direita e o ⋯ com Abrir e Anexar comprovante. Conta da
 * equipe com valor a definir pede o valor antes de pagar.
 */
export function ItemPagamento({ pagamento: p }: { pagamento: Pagamento }) {
  const { marcar, marcando } = useMarcarComoPago()
  const { desfazer, desfazendo } = useDesfazerPagamento()
  const [pedindoValor, setPedindoValor] = useState(false)
  const aDefinir = p.valorCentavos === null
  const fatura = Boolean(p.cartaoId)
  const pago = p.status === 'pago'
  const grupo = p.categoriaNome ?? p.cartaoNome ?? (p.membroId ? 'Salários equipe' : null)
  const detalhes = [grupo, p.imovelNome].filter(Boolean).join(', ')
  // Paga hoje e sem comprovante: convida a guardar o comprovante (a fatura abre em Cartões).
  const pedirComprovante = pago && p.dataPagamento === hojeISO() && p.totalComprovantes === 0 && !fatura
  // A fatura do cartão abre na aba Cartões, no mês dela.
  const endereco = fatura
    ? `/pagamentos?aba=cartoes&cartao=${p.cartaoId}&mes=${p.competencia!.slice(0, 7)}`
    : `/pagamentos/${p.id}`

  const acoes: AcaoLinha[] = [{ rotulo: fatura ? 'Abrir a fatura' : 'Abrir a conta', icone: ArrowRightIcon, para: endereco }]
  if (!fatura) acoes.push({ rotulo: 'Anexar comprovante', icone: PaperclipIcon, para: `/pagamentos/${p.id}#comprovantes` })

  return (
    <LinhaMarcavel
      estado={pago ? 'feito' : 'pendente'}
      marcar={
        pago
          ? fatura
            ? undefined
            : { rotulo: `Desfazer pagamento de ${p.descricao}`, marcado: true, desabilitado: desfazendo, aoMarcar: () => desfazer(p) }
          : {
              rotulo: aDefinir ? `Pagar ${p.descricao}` : `Marcar ${p.descricao} como pago`,
              marcado: false,
              desabilitado: marcando,
              aoMarcar: () => (aDefinir ? setPedindoValor(true) : marcar(p)),
            }
      }
      titulo={p.descricao}
      valor={aDefinir ? <SeloEstado estado="a_definir">A definir</SeloEstado> : formatarCentavos(p.valorCentavos!)}
      para={endereco}
      apoio={
        <>
          <p>
            <SituacaoConta p={p} />
            {p.totalComprovantes > 0 && (
              <PaperclipIcon className="mb-[0.15em] ml-1.5 inline size-4 align-middle" aria-label="Com comprovante" role="img" />
            )}
          </p>
          {(detalhes || p.parcelaTotal || p.recorrencia !== 'nenhuma') && (
            <p className="flex flex-wrap items-center gap-x-1.5">
              {detalhes && <span>{detalhes}</span>}
              {p.parcelaTotal && (
                <span className="tabular-nums" aria-label={`parcela ${p.parcelaAtual} de ${p.parcelaTotal}`}>
                  {detalhes && <span aria-hidden>· </span>}
                  {p.parcelaAtual}/{p.parcelaTotal}
                </span>
              )}
              {p.recorrencia !== 'nenhuma' && (
                <span className="flex items-center gap-1">
                  <RepeatIcon className="size-4" aria-hidden />
                  {textoRecorrencia[p.recorrencia]}
                </span>
              )}
            </p>
          )}
        </>
      }
      fim={
        <>
          {pedirComprovante && (
            <Link
              to={`/pagamentos/${p.id}#comprovantes`}
              aria-label={`Anexar comprovante de ${p.descricao}`}
              title="Anexar comprovante"
              className="grid size-11 shrink-0 place-items-center rounded-full text-primary hover:bg-suave"
            >
              <PaperclipIcon className="size-5" aria-hidden />
            </Link>
          )}
          <MenuLinha titulo={p.descricao} descricao={detalhes} acoes={acoes} />
          {pedindoValor && (
            <PagarComValor
              pagamento={p}
              enviando={marcando}
              aoConfirmar={(centavos) => marcar(p, centavos, () => setPedindoValor(false))}
              aoFechar={() => setPedindoValor(false)}
            />
          )}
        </>
      }
    />
  )
}
