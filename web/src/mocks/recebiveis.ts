// Recebíveis: mesmas regras de src/modules/recebiveis/service.js (status derivado dos recebimentos,
// JA_RECEBIDO, próxima ocorrência do recorrente a partir do início da série, 404 de outro usuário).
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { deDataISO, hojeISO } from '@/lib/datas'
import type { OrigemRecebivel, Recebivel, RecebivelCorpo, RecebimentoCorpo } from '@/lib/tipos'
import { agoraISO, banco, type ComprovanteRecebivelMock, type RecebivelMock } from './banco'
import { detectarTipo, lerUpload, nomeSeguro, respostaArquivo, tipoNaoAceito } from './arquivos'
import { autenticado, erro, naoEncontrado } from './util'

const MAXIMO_COMPROVANTES = 5
export const ORIGENS: OrigemRecebivel[] = ['dividendos', 'aluguel', 'rendimentos', 'honorarios', 'outros']

const idDe = (params: Record<string, unknown>) => String(params.id)
const doUsuario = (usuarioId: string, id: string) =>
  banco.recebiveis.find((r) => r.id === id && r.usuarioId === usuarioId)

const recebidoDe = (id: string) =>
  banco.recebimentos.filter((m) => m.recebivelId === id).reduce((s, m) => s + m.valorCentavos, 0)

export function paraResposta(r: RecebivelMock): Recebivel {
  const recebidoCentavos = recebidoDe(r.id)
  const status = r.encerrado || recebidoCentavos >= r.valorPrevistoCentavos ? 'recebido' : recebidoCentavos > 0 ? 'parcial' : 'pendente'
  const datas = banco.recebimentos.filter((m) => m.recebivelId === r.id).map((m) => m.data).sort()
  const { usuarioId: _u, ...publico } = r
  return {
    ...publico,
    recebidoCentavos,
    saldoCentavos: status === 'recebido' ? 0 : r.valorPrevistoCentavos - recebidoCentavos,
    status,
    atrasado: status !== 'recebido' && r.dataPrevista < hojeISO(),
    ultimoRecebimento: datas.at(-1) ?? null,
    totalComprovantes: banco.comprovantesRecebivel.filter((c) => c.recebivelId === r.id).length,
  }
}

const publicoComprovante = ({ bytes: _b, recebivelId: _r, ...c }: ComprovanteRecebivelMock) => c

function detalhe(r: RecebivelMock) {
  return {
    ...paraResposta(r),
    recebimentos: banco.recebimentos
      .filter((m) => m.recebivelId === r.id)
      .sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm))
      .map(({ recebivelId: _r, ...m }) => m),
    comprovantes: banco.comprovantesRecebivel.filter((c) => c.recebivelId === r.id).map(publicoComprovante),
  }
}

function garantirProxima(r: RecebivelMock) {
  if (r.recorrencia === 'nenhuma' || paraResposta(r).status !== 'recebido') return
  if (banco.recebiveis.some((x) => x.recorrenciaOrigemId === r.id)) return
  // Volta até o início da série para não perder o dia (31/jan → 28/fev → 31/mar).
  let inicio = r
  let passo = 0
  for (let origem = r.recorrenciaOrigemId; origem; passo++) {
    const anterior = banco.recebiveis.find((x) => x.id === origem)
    if (!anterior) break
    inicio = anterior
    origem = anterior.recorrenciaOrigemId
  }
  const unidade = r.recorrencia === 'mensal' ? 'months' : 'years'
  const agora = agoraISO()
  banco.recebiveis.push({
    ...r,
    id: crypto.randomUUID(),
    dataPrevista: deDataISO(inicio.dataPrevista).plus({ [unidade]: passo + 1 }).toISODate()!,
    encerrado: false,
    recorrenciaOrigemId: r.id,
    criadoEm: agora,
    atualizadoEm: agora,
  })
}

function validar(corpo: Partial<RecebivelCorpo>) {
  if (!corpo.descricao?.trim()) return 'descricao: Informe a descrição.'
  if (!corpo.origem || !ORIGENS.includes(corpo.origem)) return 'origem: Opção inválida.'
  if (!Number.isInteger(corpo.valorPrevistoCentavos) || corpo.valorPrevistoCentavos! <= 0)
    return 'valorPrevistoCentavos: O valor precisa ser maior que zero.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corpo.dataPrevista ?? '')) return 'dataPrevista: Data inválida: use o formato AAAA-MM-DD.'
  return null
}

const limpar = (corpo: RecebivelCorpo): RecebivelCorpo => ({
  descricao: corpo.descricao.trim(),
  origem: corpo.origem,
  valorPrevistoCentavos: corpo.valorPrevistoCentavos,
  dataPrevista: corpo.dataPrevista,
  recorrencia: corpo.recorrencia ?? 'nenhuma',
  observacoes: corpo.observacoes?.trim() || null,
})

/** Para o relatório financeiro (mocks/pagamentos.ts): mesmas contas de entradasDoPeriodo() no back-end. */
export function entradasDoPeriodo(usuarioId: string, inicio: string, fim: string) {
  const hoje = hojeISO()
  const doPeriodo = banco.recebiveis
    .filter((r) => r.usuarioId === usuarioId && r.dataPrevista >= inicio && r.dataPrevista <= fim)
    .map(paraResposta)
  const porOrigem = ORIGENS.map((origem) => {
    const lista = doPeriodo.filter((r) => r.origem === origem)
    return {
      origem,
      quantos: lista.length,
      totalCentavos: lista.reduce((s, r) => s + r.valorPrevistoCentavos, 0),
      recebidoCentavos: lista.reduce((s, r) => s + r.recebidoCentavos, 0),
      pendenteCentavos: lista.reduce((s, r) => s + r.saldoCentavos, 0),
    }
  }).filter((o) => o.quantos > 0)
  const ids = new Set(banco.recebiveis.filter((r) => r.usuarioId === usuarioId).map((r) => r.id))
  return {
    totalCentavos: porOrigem.reduce((s, o) => s + o.totalCentavos, 0),
    recebidoCentavos: porOrigem.reduce((s, o) => s + o.recebidoCentavos, 0),
    pendenteCentavos: porOrigem.reduce((s, o) => s + o.pendenteCentavos, 0),
    vencidoCentavos: doPeriodo.filter((r) => r.dataPrevista < hoje).reduce((s, r) => s + r.saldoCentavos, 0),
    recebidoNoPeriodoCentavos: banco.recebimentos
      .filter((m) => ids.has(m.recebivelId) && m.data >= inicio && m.data <= fim)
      .reduce((s, m) => s + m.valorCentavos, 0),
    porOrigem: porOrigem.map(({ quantos: _q, ...o }) => o),
  }
}

export const handlersRecebiveis = [
  http.get(
    `${API_URL}/recebiveis`,
    autenticado(({ request }, u) => {
      const q = new URL(request.url).searchParams
      const lista = banco.recebiveis
        .filter((r) => r.usuarioId === u.id)
        .filter((r) => !q.get('inicio') || r.dataPrevista >= q.get('inicio')!)
        .filter((r) => !q.get('fim') || r.dataPrevista <= q.get('fim')!)
        .filter((r) => !q.get('origem') || r.origem === q.get('origem'))
        .map(paraResposta)
        .filter((r) => !q.get('status') || r.status === q.get('status'))
        .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista) || a.descricao.localeCompare(b.descricao))
      return HttpResponse.json(lista)
    }),
  ),

  http.post(
    `${API_URL}/recebiveis`,
    autenticado(async ({ request }, u) => {
      const corpo = (await request.json()) as RecebivelCorpo
      const problema = validar(corpo)
      if (problema) return erro(400, 'VALIDACAO', problema)
      const agora = agoraISO()
      const novo: RecebivelMock = {
        id: crypto.randomUUID(),
        usuarioId: u.id,
        encerrado: false,
        recorrenciaOrigemId: null,
        criadoEm: agora,
        atualizadoEm: agora,
        ...limpar(corpo),
      }
      banco.recebiveis.push(novo)
      return HttpResponse.json(paraResposta(novo), { status: 201 })
    }),
  ),

  http.get(
    `${API_URL}/recebiveis/:id`,
    autenticado(({ params }, u) => {
      const r = doUsuario(u.id, idDe(params))
      return r ? HttpResponse.json(detalhe(r)) : naoEncontrado('Recebível')
    }),
  ),

  http.put(
    `${API_URL}/recebiveis/:id`,
    autenticado(async ({ request, params }, u) => {
      const r = doUsuario(u.id, idDe(params))
      if (!r) return naoEncontrado('Recebível')
      const corpo = (await request.json()) as RecebivelCorpo
      const problema = validar(corpo)
      if (problema) return erro(400, 'VALIDACAO', problema)
      Object.assign(r, limpar(corpo), { atualizadoEm: agoraISO() })
      garantirProxima(r)
      return HttpResponse.json(paraResposta(r))
    }),
  ),

  http.delete(
    `${API_URL}/recebiveis/:id`,
    autenticado(({ params }, u) => {
      const r = doUsuario(u.id, idDe(params))
      if (!r) return naoEncontrado('Recebível')
      banco.recebiveis = banco.recebiveis.filter((x) => x.id !== r.id)
      banco.recebimentos = banco.recebimentos.filter((m) => m.recebivelId !== r.id)
      banco.comprovantesRecebivel = banco.comprovantesRecebivel.filter((c) => c.recebivelId !== r.id)
      banco.recebiveis.forEach((x) => {
        if (x.recorrenciaOrigemId === r.id) x.recorrenciaOrigemId = null
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.post(
    `${API_URL}/recebiveis/:id/recebimentos`,
    autenticado(async ({ request, params }, u) => {
      const r = doUsuario(u.id, idDe(params))
      if (!r) return naoEncontrado('Recebível')
      const corpo = (await request.json()) as RecebimentoCorpo
      if (!Number.isInteger(corpo.valorCentavos) || corpo.valorCentavos <= 0)
        return erro(400, 'VALIDACAO', 'valorCentavos: O valor precisa ser maior que zero.')
      if (paraResposta(r).status === 'recebido') return erro(409, 'JA_RECEBIDO', 'Este valor já foi recebido.')
      banco.recebimentos.push({
        id: crypto.randomUUID(),
        recebivelId: r.id,
        valorCentavos: corpo.valorCentavos,
        data: corpo.data ?? hojeISO(),
        observacoes: corpo.observacoes?.trim() || null,
        criadoEm: agoraISO(),
      })
      if (corpo.encerrar) r.encerrado = true
      garantirProxima(r)
      return HttpResponse.json(detalhe(r), { status: 201 })
    }),
  ),

  http.delete(
    `${API_URL}/recebiveis/:id/recebimentos/:recebimentoId`,
    autenticado(({ params }, u) => {
      const r = doUsuario(u.id, idDe(params))
      if (!r) return naoEncontrado('Recebível')
      const antes = banco.recebimentos.length
      banco.recebimentos = banco.recebimentos.filter((m) => !(m.id === params.recebimentoId && m.recebivelId === r.id))
      if (banco.recebimentos.length === antes) return naoEncontrado('Recebimento')
      r.encerrado = false
      return HttpResponse.json(detalhe(r))
    }),
  ),

  http.post(
    `${API_URL}/recebiveis/:id/comprovantes`,
    autenticado(async ({ request, params }, u) => {
      const upload = await lerUpload(request)
      if ('problema' in upload) return upload.problema
      const r = doUsuario(u.id, idDe(params))
      if (!r) return naoEncontrado('Recebível')
      if (!upload.arquivo) return erro(400, 'VALIDACAO', 'arquivo: envie o arquivo no campo "arquivo".')
      const tipo = detectarTipo(upload.arquivo.bytes)
      if (!tipo) return tipoNaoAceito()
      if (banco.comprovantesRecebivel.filter((c) => c.recebivelId === r.id).length >= MAXIMO_COMPROVANTES)
        return erro(409, 'LIMITE_ANEXOS', `Cada recebível pode ter no máximo ${MAXIMO_COMPROVANTES} comprovantes.`)
      const comprovante: ComprovanteRecebivelMock = {
        id: crypto.randomUUID(),
        recebivelId: r.id,
        nomeOriginal: nomeSeguro(upload.arquivo.nomeArquivo ?? '', tipo.extensao),
        mimeType: tipo.mime,
        tamanhoBytes: upload.arquivo.bytes.byteLength,
        bytes: upload.arquivo.bytes,
        criadoEm: agoraISO(),
      }
      banco.comprovantesRecebivel.push(comprovante)
      return HttpResponse.json(publicoComprovante(comprovante), { status: 201 })
    }),
  ),

  http.get(
    `${API_URL}/recebiveis/:id/comprovantes/:comprovanteId`,
    autenticado(({ params }, u) => {
      const r = doUsuario(u.id, idDe(params))
      const c = r && banco.comprovantesRecebivel.find((x) => x.id === params.comprovanteId && x.recebivelId === r.id)
      return c ? respostaArquivo(c) : naoEncontrado('Comprovante')
    }),
  ),

  http.delete(
    `${API_URL}/recebiveis/:id/comprovantes/:comprovanteId`,
    autenticado(({ params }, u) => {
      const r = doUsuario(u.id, idDe(params))
      const antes = banco.comprovantesRecebivel.length
      if (r)
        banco.comprovantesRecebivel = banco.comprovantesRecebivel.filter(
          (x) => !(x.id === params.comprovanteId && x.recebivelId === r.id),
        )
      if (banco.comprovantesRecebivel.length === antes) return naoEncontrado('Comprovante')
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
