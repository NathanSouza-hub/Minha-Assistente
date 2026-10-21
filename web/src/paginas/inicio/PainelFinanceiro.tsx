import { useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { useRelatorioFinanceiro } from '@/consultas/pagamentos'
import { intervaloDoMes, mesDe } from '@/lib/datas'
import { NavegadorMes } from '@/paginas/pagamentos/ResumoContas'
import { BlocoFinancas } from './blocosFinanceiros'

/**
 * Finanças → Visão geral (`/financas`): só os indicadores do mês escolhido (despesas, recebíveis e
 * saldo, com o critério de cada um). O detalhe fica nas telas de cada área: próximas contas em
 * Contas a pagar, próximos recebíveis em Recebíveis, os imóveis em Residências e as categorias em
 * Pessoais. Só lê: os totais vêm de GET /relatorios/financeiro.
 */
export function PainelFinanceiro() {
  const [params, setParams] = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesDe()
  const financeiro = useRelatorioFinanceiro(intervaloDoMes(mes))

  return (
    <Pagina titulo="Finanças" larga>
      <div className="flex flex-col gap-5">
        <NavegadorMes
          mes={mes}
          aoMudar={(novo) => setParams(novo === mesDe() ? {} : { mes: novo }, { replace: true })}
        />
        <BlocoFinancas consulta={financeiro} mes={mes} />
      </div>
    </Pagina>
  )
}
