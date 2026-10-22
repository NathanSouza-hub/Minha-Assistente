import { Bloco, Vazio } from '@/components/Bloco'
import { BarraPago, PagoPendente } from '@/components/ResumoValores'
import { useRelatorioFinanceiro } from '@/consultas/pagamentos'
import { intervaloDoMes } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'

/** Topo da Lista de despesas filtrada em "pessoais": totais do mês e a distribuição por categoria
 * (de GET /relatorios/financeiro, sem somar no front). */
export function ResumoPessoais({ mes }: { mes: string }) {
  const consulta = useRelatorioFinanceiro(intervaloDoMes(mes))
  return (
    <Bloco titulo="Despesas pessoais do mês" area="contas" consulta={consulta}>
      {() => {
        const p = consulta.data!.pessoal
        if (p.categorias.length === 0) return <Vazio>Nenhuma despesa pessoal neste mês.</Vazio>
        const maior = Math.max(...p.categorias.map((c) => c.totalCentavos), 1)
        return (
          <div className="flex flex-col gap-4">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Total do mês</span>
              <span className="text-2xl font-bold tabular-nums">{formatarCentavos(p.totalCentavos)}</span>
            </p>
            <BarraPago v={p} />
            <PagoPendente v={p} />
            <ul className="flex flex-col gap-2.5" aria-label="Por categoria">
              {p.categorias.map((c) => (
                <li key={c.id ?? c.nome} className="flex flex-col gap-1">
                  <span className="flex justify-between gap-3 text-base">
                    <span>{c.nome}</span>
                    <span className="font-semibold tabular-nums">{formatarCentavos(c.totalCentavos)}</span>
                  </span>
                  <div className="h-2 rounded-full bg-suave" aria-hidden>
                    <div
                      className="h-full rounded-full bg-area"
                      style={{ width: `${Math.round((c.totalCentavos / maior) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      }}
    </Bloco>
  )
}
