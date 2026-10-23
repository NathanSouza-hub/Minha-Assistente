import { useSearchParams } from 'react-router'
import { useRelatorioFinanceiro } from '@/consultas/pagamentos'
import { intervaloDoMes, mesDe } from '@/lib/datas'
import { NavegadorMes } from '@/paginas/pagamentos/ResumoContas'
import { BlocoFinancas } from './blocosFinanceiros'

/**
 * Aba "Visão geral" de Finanças (`/financas`, a primeira; as outras são o relatório em
 * `paginas/Relatorio.tsx`): só os indicadores do mês escolhido (despesas, recebíveis e saldo, com o
 * critério de cada um). O detalhe fica nas telas de cada área: próximas contas em Contas a pagar,
 * próximos recebíveis em Recebíveis, os imóveis em Residências e as categorias em Pessoais. Só lê:
 * os totais vêm de GET /relatorios/financeiro.
 */
export function VisaoGeral() {
  const [params, setParams] = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesDe()
  const financeiro = useRelatorioFinanceiro(intervaloDoMes(mes))

  return (
    <div className="flex flex-col gap-5">
      <NavegadorMes
        mes={mes}
        aoMudar={(novo) =>
          setParams(
            (antes) => {
              const proximo = new URLSearchParams(antes)
              if (novo === mesDe()) proximo.delete('mes')
              else proximo.set('mes', novo)
              return proximo
            },
            { replace: true },
          )
        }
      />
      <BlocoFinancas consulta={financeiro} mes={mes} />
    </div>
  )
}
