import { Navegador } from '@/components/NavegadorDia'
import { SeloEstado } from '@/components/Estado'
import { nomeDoMes, somarMeses } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { Pagamento } from '@/lib/tipos'

/** "Outubro de 2026" e as setas — mês no formato "AAAA-MM". */
export function NavegadorMes({ mes, aoMudar }: { mes: string; aoMudar: (mes: string) => void }) {
  return (
    <Navegador
      rotulo="Mês"
      titulo={nomeDoMes(mes)}
      anterior={{ rotulo: 'Mês anterior', ir: () => aoMudar(somarMeses(mes, -1)) }}
      proximo={{ rotulo: 'Próximo mês', ir: () => aoMudar(somarMeses(mes, 1)) }}
    />
  )
}

// Conta com valor a definir (equipe) não soma: aparece à parte, como "+ 2 a definir".
const soma = (lista: Pagamento[]) => lista.reduce((total, p) => total + (p.valorCentavos ?? 0), 0)

/** "A pagar" (com vencidas e a definir) e "Pago" das contas da lista. */
export function ResumoContas({ pagamentos }: { pagamentos: Pagamento[] }) {
  const aPagar = pagamentos.filter((p) => p.status === 'pendente')
  const vencidos = aPagar.filter((p) => p.vencido).length
  const aDefinir = aPagar.filter((p) => p.valorCentavos === null).length

  return (
    <dl className="superficie grid grid-cols-2 divide-x divide-linha">
      <div className="min-w-0 px-4 py-3">
        <dt className="text-[0.88rem] text-muted-foreground">A pagar</dt>
        <dd className="text-xl font-bold tabular-nums">{formatarCentavos(soma(aPagar))}</dd>
        {aDefinir > 0 && (
          <dd className="text-[0.88rem]">
            <SeloEstado estado="a_definir">+ {aDefinir} a definir</SeloEstado>
          </dd>
        )}
        {vencidos > 0 && (
          <dd className="text-[0.88rem]">
            <SeloEstado estado="vencido">{vencidos === 1 ? '1 conta vencida' : `${vencidos} contas vencidas`}</SeloEstado>
          </dd>
        )}
      </div>
      <div className="min-w-0 px-4 py-3">
        <dt className="text-[0.88rem] text-muted-foreground">Pago</dt>
        <dd className="text-xl font-bold tabular-nums">
          {formatarCentavos(soma(pagamentos.filter((p) => p.status === 'pago')))}
        </dd>
      </div>
    </dl>
  )
}
