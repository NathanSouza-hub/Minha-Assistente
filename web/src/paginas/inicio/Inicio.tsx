import { BellIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { useSessao } from '@/app/useSessao'
import { Pagina } from '@/components/layout/Pagina'
import { Button } from '@/components/ui/button'
import { useTarefasHoje } from '@/consultas/hoje'
import { useRelatorioFinanceiro } from '@/consultas/pagamentos'
import { dataPorExtenso, hojeISO, intervaloDoMes, mesDe, saudacao } from '@/lib/datas'
import {
  BlocoContasPendentes,
  BlocoFinancas,
  BlocoPessoais,
  BlocoRecebiveis,
  BlocoResidencias,
} from './blocosFinanceiros'
import { BlocoAgenda, BlocoHoje, BlocoRemedios } from './blocosDoDia'

/** "Boa tarde, <primeiro nome da conta>" e a data de hoje por extenso. */
function Cabecalho() {
  const { usuario } = useSessao()
  const primeiroNome = usuario?.nome.trim().split(/\s+/)[0]
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h1 className="text-[2rem] leading-tight font-[750] tracking-[-0.01em] md:text-[2.5rem]">
        {saudacao()}
        {primeiroNome && `, ${primeiroNome}`}
      </h1>
      <p className="text-lg font-semibold text-muted-foreground">{dataPorExtenso(hojeISO())}</p>
    </div>
  )
}

/**
 * Painel (`/`): o dia, as finanças do mês, as residências e o que vem pela frente, cada bloco com o
 * atalho para a tela da área. Só lê (as mesmas consultas das telas, compartilhadas pelo cache);
 * os únicos botões que escrevem são o ✓/✗ das tarefas, iguais aos da tela Hoje.
 */
export function Inicio() {
  const hoje = hojeISO()
  const mes = mesDe(hoje)
  const dia = useTarefasHoje(hoje)
  const financeiro = useRelatorioFinanceiro(intervaloDoMes(mes))

  return (
    <Pagina
      titulo="Início"
      larga
      cabecalho={<Cabecalho />}
      acoes={
        <Button asChild size="icon" variant="default" aria-label="Notificações">
          <Link to="/notificacoes">
            <BellIcon className="size-6" weight="bold" aria-hidden />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <BlocoFinancas consulta={financeiro} mes={mes} />
        <BlocoHoje consulta={dia} />
        <BlocoRemedios consulta={dia} />
        <BlocoContasPendentes />
        <BlocoAgenda />
        <BlocoResidencias consulta={financeiro} />
        <BlocoPessoais consulta={financeiro} mes={mes} />
        <BlocoRecebiveis consulta={financeiro} mes={mes} />
      </div>
    </Pagina>
  )
}
