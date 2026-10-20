import { useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { useRelatorioFinanceiro } from '@/consultas/pagamentos'
import { intervaloDoMes, mesDe } from '@/lib/datas'
import { NavegadorMes } from '@/paginas/pagamentos/ResumoContas'
import {
  BlocoContasPendentes,
  BlocoFinancas,
  BlocoPessoais,
  BlocoRecebiveis,
  BlocoResidencias,
} from './blocosFinanceiros'

/**
 * Finanças → Visão geral (`/financas`): os números do mês escolhido (despesas, recebíveis e saldo,
 * com o critério de cada um), as próximas contas e recebíveis, as residências e as despesas
 * pessoais. Só lê: os totais vêm de GET /relatorios/financeiro.
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
        <div className="grid gap-5 lg:grid-cols-2">
          <BlocoFinancas consulta={financeiro} mes={mes} />
          <BlocoContasPendentes />
          <BlocoRecebiveis consulta={financeiro} mes={mes} />
          <BlocoResidencias consulta={financeiro} />
          <BlocoPessoais consulta={financeiro} mes={mes} />
        </div>
      </div>
    </Pagina>
  )
}
