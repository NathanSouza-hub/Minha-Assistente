import { Link } from 'react-router'
import { Bloco, Vazio } from '@/components/Bloco'
import { SeloEstado } from '@/components/Estado'
import { usePagamentos } from '@/consultas/pagamentos'
import { hojeISO, somarDias } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Pagamento } from '@/lib/tipos'
import { SituacaoConta } from './ItemPagamento'

const QUANTAS_CONTAS = 5

/** A fatura do cartão abre na aba Cartões, no mês dela; as outras contas, no formulário. */
const enderecoConta = (p: Pagamento) =>
  p.cartaoId ? `/pagamentos?aba=cartoes&cartao=${p.cartaoId}&mes=${p.competencia!.slice(0, 7)}` : `/pagamentos/${p.id}`

/**
 * Topo de Contas a pagar: as próximas pendentes de todas as categorias (as vencidas primeiro, pela
 * ordem de vencimento) até 30 dias à frente.
 */
export function ProximasContas() {
  const consulta = usePagamentos({ status: 'pendente', fim: somarDias(hojeISO(), 30) })
  return (
    <Bloco
      titulo="Próximas contas a pagar"
      area="contas"
      link={{ para: '/despesas?status=pendente', rotulo: 'Ver todas' }}
      consulta={consulta}
    >
      {() => {
        const contas = consulta.data!
        if (contas.length === 0) return <Vazio>Nenhuma conta a pagar nos próximos 30 dias.</Vazio>
        const restantes = contas.length - QUANTAS_CONTAS
        return (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y divide-linha">
              {contas.slice(0, QUANTAS_CONTAS).map((p) => (
                <li key={p.id}>
                  <Link
                    to={enderecoConta(p)}
                    className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-suave/60"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{p.descricao}</span>
                      <span className="text-[0.88rem] text-muted-foreground">{p.imovelNome ?? 'Pessoal'}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      {p.valorCentavos === null ? (
                        <SeloEstado estado="a_definir">A definir</SeloEstado>
                      ) : (
                        <span className="font-bold tabular-nums">{formatarCentavos(p.valorCentavos)}</span>
                      )}
                      <span className="text-[0.88rem] text-muted-foreground">
                        <SituacaoConta p={p} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {restantes > 0 && (
              <p className="text-base text-muted-foreground">
                E mais {restantes === 1 ? '1 conta' : `${restantes} contas`} nos próximos 30 dias.
              </p>
            )}
          </div>
        )
      }}
    </Bloco>
  )
}
