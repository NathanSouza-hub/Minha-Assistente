// Tarefas do dia — espelha src/modules/hoje/tarefas.js do back-end: o que ocorre no dia em cada
// área, numa lista só, com ✓/✗. O "feito" de remédio, compromisso e despesa fica na própria área.
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { agora, deDataHoraISO, deDataISO, FUSO, hojeISO, somarDias } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { CategoriaTarefa, MarcacaoTarefa, Pagamento, TarefaHoje } from '@/lib/tipos'
import { agoraISO, banco } from './banco'
import { ocorrenciasDoPeriodo } from './eventos'
import { dosesDoDia, limparNaoTomado } from './medicamentos'
import { garantirProxima, listarPagamentos } from './pagamentos'
import { tarefasDoDia } from './rotinas'
import { concluirTarefa, tarefasAvulsasDoDia } from './tarefas'
import { autenticado, erro, naoEncontrado } from './util'

const CATEGORIA_DO_TIPO: Record<string, CategoriaTarefa> = {
  programa_radio: 'radio',
  atividade_fisica: 'atividade',
  fisioterapia: 'fisioterapia',
}
const LINK_DA_CATEGORIA: Partial<Record<CategoriaTarefa, string>> = {
  radio: '/radio',
  atividade: '/atividade-fisica',
  fisioterapia: '/fisioterapia',
}
const ORDEM: CategoriaTarefa[] = [
  'remedio',
  'agenda',
  'radio',
  'atividade',
  'fisioterapia',
  'compromisso',
  'tarefa',
  'viagem',
  'despesa',
]

const inicialMaiuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
const juntar = (partes: (string | null | false)[]) => partes.filter(Boolean).join(' · ') || null
const montarId = (categoria: string, itemId: string, data: string, horario: string | null) =>
  `${categoria}:${itemId}:${horario ? `${data}T${horario}` : data}`

/** `data`/`horario` identificam a ocorrência; `exibido` é o horário mostrado no dia. */
type Ocorrencia = Omit<TarefaHoje, 'id' | 'status' | 'horario'> & {
  itemId: string
  data: string
  horario: string | null
  exibido: string | null
  feito?: boolean
}

function ocorrencia(
  categoria: CategoriaTarefa,
  itemId: string,
  data: string,
  horario: string | null,
  campos: Pick<Ocorrencia, 'titulo' | 'detalhe' | 'link'> & Partial<Ocorrencia>,
): Ocorrencia {
  return { categoria, itemId, data, horario, exibido: horario, concluirNoFormulario: false, ...campos }
}

function despesa(p: Pagamento, data: string) {
  return ocorrencia('despesa', p.id, p.vencimento, null, {
    titulo: inicialMaiuscula(p.descricao),
    detalhe: juntar([
      p.valorCentavos === null ? 'Valor a definir' : formatarCentavos(p.valorCentavos),
      p.imovelNome,
      p.vencimento < data && `Venceu em ${deDataISO(p.vencimento).toFormat('dd/MM')}`,
    ]),
    link: p.cartaoId ? `/cartoes/${p.cartaoId}` : `/pagamentos/${p.id}`,
    feito: p.status === 'pago',
    concluirNoFormulario: p.status === 'pendente' && p.valorCentavos === null,
  })
}

function doModulos(usuarioId: string, data: string): Ocorrencia[] {
  const ontem = somarDias(data, -1)
  // Olhando hoje, entram as vencidas antes e ainda pendentes, e as que foram pagas hoje.
  const anteriores =
    data === hojeISO()
      ? [
          ...listarPagamentos(usuarioId, { status: 'pendente', fim: ontem }),
          ...listarPagamentos(usuarioId, { status: 'pago', fim: ontem }).filter((p) => p.dataPagamento === data),
        ].sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      : []

  return [
    ...dosesDoDia(usuarioId, data).map((d) =>
      ocorrencia('remedio', d.horarioId, data, d.hora, {
        titulo: inicialMaiuscula(d.nome),
        detalhe: d.dose,
        link: `/remedios/${d.medicamentoId}`,
        feito: d.tomado,
      }),
    ),
    ...ocorrenciasDoPeriodo(usuarioId, data, data).map((e) => {
      const inicio = deDataHoraISO(e.inicio).setZone(FUSO)
      const categoria = CATEGORIA_DO_TIPO[e.tipo] ?? 'agenda'
      return ocorrencia(categoria, e.id, inicio.toISODate()!, inicio.toFormat('HH:mm'), {
        exibido: inicio.toISODate() === data ? inicio.toFormat('HH:mm') : null,
        titulo: inicialMaiuscula(e.titulo),
        detalhe: e.local,
        link: LINK_DA_CATEGORIA[categoria] ?? `/agenda/${e.id}`,
      })
    }),
    ...tarefasDoDia(usuarioId, data).map((t) =>
      ocorrencia('compromisso', t.rotinaId, data, t.hora, {
        titulo: inicialMaiuscula(t.titulo),
        detalhe: null,
        link: `/rotina/${t.rotinaId}`,
        feito: t.concluida,
      }),
    ),
    ...tarefasAvulsasDoDia(usuarioId, data).map((t) =>
      ocorrencia('tarefa', t.id, t.data, t.hora, {
        exibido: t.data === data ? t.hora : null,
        titulo: inicialMaiuscula(t.titulo),
        detalhe: juntar([t.detalhes, t.data < data && `Era para ${deDataISO(t.data).toFormat('dd/MM')}`]),
        link: `/tarefas/${t.id}`,
        feito: t.concluida,
      }),
    ),
    ...banco.viagens
      .filter((v) => v.usuarioId === usuarioId && (v.ida === data || v.volta === data))
      .map((v) =>
        ocorrencia('viagem', v.id, data, null, {
          titulo: `Viagem para ${v.destino}`,
          detalhe: juntar([v.ida === v.volta ? 'Ida e volta' : v.ida === data ? 'Ida' : 'Volta', v.transporte]),
          link: `/viagens/${v.id}`,
        }),
      ),
    ...[...anteriores, ...listarPagamentos(usuarioId, { inicio: data, fim: data })].map((p) => despesa(p, data)),
  ]
}

function passou({ data, horario }: Ocorrencia) {
  if (!horario) return data < hojeISO()
  return deDataISO(data).set({ hour: Number(horario.slice(0, 2)), minute: Number(horario.slice(3)) }) < agora()
}

function itens(usuarioId: string, data: string) {
  return doModulos(usuarioId, data)
    .map((o) => {
      const id = montarId(o.categoria, o.itemId, o.data, o.horario)
      const registrado = banco.registrosTarefa.find(
        (r) => r.usuarioId === usuarioId && montarId(r.categoria, r.itemId, r.dataOcorrencia, r.horario) === id,
      )?.status
      // Nas áreas com "feito" próprio, vale a área; do registro só o "não feito".
      const status = o.feito ? 'feito' : o.feito === false && registrado === 'feito' ? undefined : registrado
      const tarefa: TarefaHoje = {
        id,
        categoria: o.categoria,
        titulo: o.titulo,
        detalhe: o.detalhe ?? null,
        horario: o.exibido,
        status: status ?? (passou(o) ? 'atrasado' : 'pendente'),
        link: o.link,
        concluirNoFormulario: o.concluirNoFormulario,
      }
      return { tarefa, o }
    })
    .sort(
      (a, b) =>
        (a.tarefa.horario ?? '99:99').localeCompare(b.tarefa.horario ?? '99:99') ||
        ORDEM.indexOf(a.o.categoria) - ORDEM.indexOf(b.o.categoria),
    )
}

function marcarNaArea(usuarioId: string, o: Ocorrencia, feito: boolean) {
  if (o.categoria === 'remedio') {
    limparNaoTomado(usuarioId, o.itemId, o.data)
    banco.registrosRemedio = banco.registrosRemedio.filter((r) => !(r.horarioId === o.itemId && r.data === o.data))
    if (feito) banco.registrosRemedio.push({ horarioId: o.itemId, data: o.data, tomadoEm: agoraISO() })
  }
  if (o.categoria === 'compromisso') {
    banco.conclusoesRotina = banco.conclusoesRotina.filter((c) => !(c.rotinaId === o.itemId && c.data === o.data))
    if (feito) banco.conclusoesRotina.push({ rotinaId: o.itemId, data: o.data, concluidaEm: agoraISO() })
  }
  if (o.categoria === 'tarefa') concluirTarefa(usuarioId, o.itemId, feito)
  if (o.categoria === 'despesa') {
    const p = banco.pagamentos.find((x) => x.id === o.itemId && x.usuarioId === usuarioId)!
    if (feito && p.status === 'pendente') {
      Object.assign(p, { status: 'pago', dataPagamento: hojeISO(), atualizadoEm: agoraISO() })
      garantirProxima(p)
    }
    if (!feito && p.status === 'pago') Object.assign(p, { status: 'pendente', dataPagamento: null, atualizadoEm: agoraISO() })
  }
}

const ID_TAREFA = /^[a-z]+:[0-9a-f-]{36}:\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/

export const handlersHoje = [
  http.get(
    `${API_URL}/hoje`,
    autenticado(({ request }, u) => {
      const data = new URL(request.url).searchParams.get('data') ?? hojeISO()
      const tarefas = itens(u.id, data).map((i) => i.tarefa)
      const contar = (status: TarefaHoje['status']) => tarefas.filter((t) => t.status === status).length
      return HttpResponse.json({
        data,
        resumo: {
          programadas: tarefas.length,
          concluidas: contar('feito'),
          pendentes: contar('pendente'),
          atrasadas: contar('atrasado'),
        },
        tarefas,
      })
    }),
  ),

  http.patch(
    `${API_URL}/hoje/:id`,
    autenticado(async ({ request, params }, u) => {
      const id = decodeURIComponent(String(params.id))
      const { status } = (await request.json()) as { status?: MarcacaoTarefa }
      if (!ID_TAREFA.test(id)) return erro(400, 'VALIDACAO', 'id: Tarefa inválida.')
      if (!status || !['feito', 'nao_feito', 'pendente'].includes(status)) {
        return erro(400, 'VALIDACAO', 'status: Opção inválida.')
      }
      const data = id.split(':')[2].slice(0, 10)
      const item = itens(u.id, data).find((i) => i.tarefa.id === id)
      if (!item) return naoEncontrado('Tarefa', { feminino: true })
      if (status === 'feito' && item.tarefa.concluirNoFormulario) {
        return erro(400, 'VALIDACAO', 'valorCentavos: Informe o valor pago na própria conta.')
      }

      const { o } = item
      const temFeitoNaArea = o.feito !== undefined
      if (temFeitoNaArea) marcarNaArea(u.id, o, status === 'feito')
      banco.registrosTarefa = banco.registrosTarefa.filter(
        (r) =>
          !(
            r.usuarioId === u.id &&
            r.categoria === o.categoria &&
            r.itemId === o.itemId &&
            r.dataOcorrencia === o.data &&
            r.horario === o.horario
          ),
      )
      if (status === 'nao_feito' || (status === 'feito' && !temFeitoNaArea)) {
        banco.registrosTarefa.push({
          usuarioId: u.id,
          categoria: o.categoria,
          itemId: o.itemId,
          dataOcorrencia: o.data,
          horario: o.horario,
          status,
        })
      }
      return HttpResponse.json(itens(u.id, data).find((i) => i.tarefa.id === id)!.tarefa)
    }),
  ),
]
