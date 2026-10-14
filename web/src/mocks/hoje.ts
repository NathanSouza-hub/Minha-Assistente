// Painel Hoje — espelha src/modules/hoje do back-end (etapa 8): junta as outras áreas com as
// mesmas regras.
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { hojeISO, somarDias } from '@/lib/datas'
import type { Pagamento } from '@/lib/tipos'
import { ocorrenciasDoPeriodo } from './eventos'
import { dosesDoDia } from './medicamentos'
import { listarPagamentos } from './pagamentos'
import { tarefasDoDia } from './rotinas'
import { autenticado } from './util'

const DIAS_A_VENCER = 7
const total = (lista: Pagamento[]) => lista.reduce((soma, p) => soma + p.valorCentavos, 0)

export const handlersHoje = [
  http.get(
    `${API_URL}/hoje`,
    autenticado(({ request }, u) => {
      const data = new URL(request.url).searchParams.get('data') ?? hojeISO()
      const eventos = ocorrenciasDoPeriodo(u.id, data, data)
      const medicamentos = dosesDoDia(u.id, data)
      const rotina = tarefasDoDia(u.id, data)
      const vencidos = listarPagamentos(u.id, { status: 'pendente', fim: somarDias(data, -1) })
      const aVencer = listarPagamentos(u.id, {
        status: 'pendente',
        inicio: data,
        fim: somarDias(data, DIAS_A_VENCER),
      })
      return HttpResponse.json({
        data,
        resumo: {
          eventos: eventos.length,
          remediosPendentes: medicamentos.filter((m) => !m.tomado).length,
          tarefasPendentes: rotina.filter((t) => !t.concluida).length,
          pagamentosVencidos: vencidos.length,
          pagamentosAVencer: aVencer.length,
        },
        eventos,
        medicamentos,
        rotina,
        pagamentos: {
          vencidos,
          aVencer,
          totalVencidoCentavos: total(vencidos),
          totalAVencerCentavos: total(aVencer),
        },
      })
    }),
  ),
]
