// Imóveis, categorias, pagamentos e relatório — regras espelhando src/modules/* do back-end (etapa 4).
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { deDataISO, hojeISO } from '@/lib/datas'
import type { Pagamento, PagamentoCriacao, PagamentoEdicao, Comprovante } from '@/lib/tipos'
import { agoraISO, banco, novoPagamento, type CategoriaMock, type PagamentoMock, type ComprovanteMock } from './banco'
import { detectarTipo, lerUpload, nomeSeguro, respostaArquivo, tipoNaoAceito } from './arquivos'
import { garantirContasEquipe } from './equipe'
import { autenticado, erro, naoEncontrado } from './util'

const idDe = (params: Record<string, unknown>) => String(params.id)

// ---------- Imóveis ----------

const imoveisDo = (usuarioId: string) =>
  banco.imoveis
    .filter((i) => i.usuarioId === usuarioId)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))

const publicoImovel = ({ id, nome, ordem }: { id: string; nome: string; ordem: number }) => ({
  id,
  nome,
  ordem,
})

const nomeRepetido = (usuarioId: string, nome: string, exceto?: string) =>
  banco.imoveis.some((i) => i.usuarioId === usuarioId && i.nome === nome && i.id !== exceto)

const imovelDuplicado = () => erro(409, 'IMOVEL_DUPLICADO', 'Você já tem um imóvel com esse nome.')

// ---------- Categorias (de cada usuário) ----------

const categoriasDo = (usuarioId: string) =>
  banco.categorias
    .filter((c) => c.usuarioId === usuarioId)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))

const publicoCategoria = ({ id, nome, ordem }: CategoriaMock) => ({ id, nome, ordem })

// Mesmo índice do back-end: lower(nome) por usuário.
const categoriaRepetida = (usuarioId: string, nome: string, exceto?: string) =>
  banco.categorias.some(
    (c) => c.usuarioId === usuarioId && c.nome.toLowerCase() === nome.toLowerCase() && c.id !== exceto,
  )

const categoriaDuplicada = () =>
  erro(409, 'CATEGORIA_DUPLICADA', 'Você já tem uma categoria com esse nome.')

function validarNomeCategoria(nome: unknown) {
  const limpo = typeof nome === 'string' ? nome.trim() : ''
  if (!limpo) return { problema: erro(400, 'VALIDACAO', 'nome: Informe o nome da categoria.') }
  if (limpo.length > 40) return { problema: erro(400, 'VALIDACAO', 'nome: Nome longo demais.') }
  return { limpo }
}

// ---------- Pagamentos ----------

function paraResposta(p: PagamentoMock): Pagamento {
  const { usuarioId: _u, ...resto } = p
  return {
    ...resto,
    categoriaNome: banco.categorias.find((c) => c.id === p.categoriaId)?.nome ?? null,
    cartaoNome: banco.cartoes.find((c) => c.id === p.cartaoId)?.nome ?? null,
    membroNome: banco.membros.find((m) => m.id === p.membroId)?.nome ?? null,
    imovelNome: banco.imoveis.find((i) => i.id === p.imovelId)?.nome ?? null,
    vencido: p.status === 'pendente' && p.vencimento < hojeISO(),
    totalComprovantes: banco.comprovantes.filter((c) => c.pagamentoId === p.id).length,
  }
}

const MAXIMO_COMPROVANTES = 5

const publicoComprovante = ({ id, nomeOriginal, mimeType, tamanhoBytes, criadoEm }: ComprovanteMock): Comprovante => ({
  id,
  nomeOriginal,
  mimeType,
  tamanhoBytes,
  criadoEm,
})

const ordenar = (a: PagamentoMock, b: PagamentoMock) =>
  a.vencimento.localeCompare(b.vencimento) ||
  (a.parcelaAtual ?? 0) - (b.parcelaAtual ?? 0) ||
  a.criadoEm.localeCompare(b.criadoEm)

const somar = (data: string, quantidade: number, unidade: 'months' | 'years') =>
  deDataISO(data)
    .plus({ [unidade]: quantidade })
    .toISODate()!

/** Mesmo cálculo de garantirProxima() no back-end: a partir do início da série. */
export function garantirProxima(p: PagamentoMock) {
  if (p.recorrencia === 'nenhuma' || p.status !== 'pago') return
  if (banco.pagamentos.some((x) => x.recorrenciaOrigemId === p.id)) return
  let inicio = p
  let passo = 0
  while (inicio.recorrenciaOrigemId) {
    const anterior = banco.pagamentos.find((x) => x.id === inicio.recorrenciaOrigemId)
    if (!anterior) break
    inicio = anterior
    passo += 1
  }
  banco.pagamentos.push(
    novoPagamento({
      usuarioId: p.usuarioId,
      descricao: p.descricao,
      categoriaId: p.categoriaId,
      imovelId: p.imovelId,
      valorCentavos: p.valorCentavos,
      vencimento: somar(inicio.vencimento, passo + 1, p.recorrencia === 'mensal' ? 'months' : 'years'),
      recorrencia: p.recorrencia,
      recorrenciaOrigemId: p.id,
      observacoes: p.observacoes,
    }),
  )
}

/** Validações principais do schema.js; devolve a resposta de erro ou null. */
function validar(d: PagamentoEdicao, usuarioId: string) {
  const problemas: string[] = []
  if (!d.descricao?.trim()) problemas.push('descricao: Informe a descrição.')
  if (!Number.isInteger(d.valorCentavos) || d.valorCentavos! <= 0)
    problemas.push('valorCentavos: O valor precisa ser maior que zero.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.vencimento ?? '')) problemas.push('vencimento: Data inválida.')
  if (d.status === 'pago' && !d.dataPagamento) problemas.push('dataPagamento: Informe a data do pagamento.')
  if (d.status === 'pendente' && d.dataPagamento)
    problemas.push('dataPagamento: Pagamento pendente não tem data de pagamento.')
  if (problemas.length) return erro(400, 'VALIDACAO', problemas.join('; '))
  if (!d.categoriaId) return erro(400, 'VALIDACAO', 'categoriaId: Escolha a categoria.')
  if (!banco.categorias.some((c) => c.id === d.categoriaId && c.usuarioId === usuarioId))
    return erro(400, 'VALIDACAO', 'categoriaId: categoria não encontrada.')
  if (d.imovelId && !banco.imoveis.some((i) => i.id === d.imovelId && i.usuarioId === usuarioId))
    return erro(400, 'VALIDACAO', 'imovelId: imóvel não encontrado.')
  return null
}

const comPadroes = (d: Partial<PagamentoEdicao>): PagamentoEdicao =>
  ({
    status: 'pendente',
    recorrencia: 'nenhuma',
    imovelId: null,
    dataPagamento: null,
    ...d,
    observacoes: d.observacoes?.trim() || null,
  }) as PagamentoEdicao

const gravaveis = (d: PagamentoEdicao) => ({
  descricao: d.descricao.trim(),
  categoriaId: d.categoriaId,
  imovelId: d.imovelId,
  valorCentavos: d.valorCentavos,
  vencimento: d.vencimento,
  status: d.status,
  dataPagamento: d.dataPagamento,
  recorrencia: d.recorrencia,
  observacoes: d.observacoes,
})

const doUsuario = (usuarioId: string, id: string) =>
  banco.pagamentos.find((p) => p.id === id && p.usuarioId === usuarioId)

// A conta da fatura é mantida pelas compras do cartão (mocks/cartoes.ts): aqui só pode ser paga.
const faturaAutomatica = () => erro(409, 'FATURA_AUTOMATICA', 'O valor da fatura vem das compras do cartão.')

type Filtros = Partial<Record<'inicio' | 'fim' | 'status' | 'categoriaId' | 'imovelId', string | null>>

/** Mesmo que listar() no back-end: filtros pelo vencimento, em ordem de vencimento. */
export function listarPagamentos(usuarioId: string, f: Filtros = {}) {
  // Como no back-end: antes de listar, garante as contas da equipe.
  garantirContasEquipe(usuarioId)
  return banco.pagamentos
    .filter((p) => p.usuarioId === usuarioId)
    .filter((p) => !f.inicio || p.vencimento >= f.inicio)
    .filter((p) => !f.fim || p.vencimento <= f.fim)
    .filter((p) => !f.status || p.status === f.status)
    .filter((p) => !f.categoriaId || p.categoriaId === f.categoriaId)
    .filter((p) => !f.imovelId || p.imovelId === f.imovelId)
    .sort(ordenar)
    .map(paraResposta)
}

export const handlersPagamentos = [
  http.get(
    `${API_URL}/categorias-pagamento`,
    autenticado((_ctx, u) => HttpResponse.json(categoriasDo(u.id).map(publicoCategoria))),
  ),

  http.post(
    `${API_URL}/categorias-pagamento`,
    autenticado(async ({ request }, u) => {
      const { nome, ordem } = (await request.json()) as { nome?: string; ordem?: number }
      const { limpo, problema } = validarNomeCategoria(nome)
      if (problema) return problema
      if (categoriaRepetida(u.id, limpo)) return categoriaDuplicada()
      const ultima = Math.max(0, ...categoriasDo(u.id).map((c) => c.ordem))
      const categoria = { id: crypto.randomUUID(), usuarioId: u.id, nome: limpo, ordem: ordem ?? ultima + 1 }
      banco.categorias.push(categoria)
      return HttpResponse.json(publicoCategoria(categoria), { status: 201 })
    }),
  ),

  http.put(
    `${API_URL}/categorias-pagamento/:id`,
    autenticado(async ({ request, params }, u) => {
      const { nome, ordem } = (await request.json()) as { nome?: string; ordem?: number }
      const categoria = banco.categorias.find((c) => c.id === idDe(params) && c.usuarioId === u.id)
      if (!categoria) return naoEncontrado('Categoria')
      if (nome === undefined && ordem === undefined)
        return erro(400, 'VALIDACAO', 'Informe o nome ou a ordem.')
      if (nome !== undefined) {
        const { limpo, problema } = validarNomeCategoria(nome)
        if (problema) return problema
        if (categoriaRepetida(u.id, limpo, categoria.id)) return categoriaDuplicada()
        categoria.nome = limpo
      }
      if (ordem !== undefined) categoria.ordem = ordem
      return HttpResponse.json(publicoCategoria(categoria))
    }),
  ),

  http.delete(
    `${API_URL}/categorias-pagamento/:id`,
    autenticado(({ params }, u) => {
      const indice = banco.categorias.findIndex((c) => c.id === idDe(params) && c.usuarioId === u.id)
      if (indice < 0) return naoEncontrado('Categoria')
      const id = idDe(params)
      if (banco.pagamentos.some((p) => p.categoriaId === id) || banco.comprasCartao.some((c) => c.categoriaId === id)) {
        return erro(
          409,
          'REFERENCIA_INVALIDA',
          'Esta categoria tem contas. Mude a categoria dessas contas antes de apagar.',
        )
      }
      banco.categorias.splice(indice, 1)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    `${API_URL}/imoveis`,
    autenticado((_ctx, u) => HttpResponse.json(imoveisDo(u.id).map(publicoImovel))),
  ),

  http.post(
    `${API_URL}/imoveis`,
    autenticado(async ({ request }, u) => {
      const { nome, ordem = 0 } = (await request.json()) as { nome?: string; ordem?: number }
      const limpo = nome?.trim()
      if (!limpo) return erro(400, 'VALIDACAO', 'nome: Informe o nome do imóvel.')
      if (nomeRepetido(u.id, limpo)) return imovelDuplicado()
      const imovel = { id: crypto.randomUUID(), usuarioId: u.id, nome: limpo, ordem }
      banco.imoveis.push(imovel)
      return HttpResponse.json(publicoImovel(imovel), { status: 201 })
    }),
  ),

  http.put(
    `${API_URL}/imoveis/:id`,
    autenticado(async ({ request, params }, u) => {
      const { nome, ordem } = (await request.json()) as { nome?: string; ordem?: number }
      const imovel = banco.imoveis.find((i) => i.id === idDe(params) && i.usuarioId === u.id)
      if (!imovel) return naoEncontrado('Imóvel')
      const limpo = nome?.trim()
      if (!limpo) return erro(400, 'VALIDACAO', 'nome: Informe o nome do imóvel.')
      if (nomeRepetido(u.id, limpo, imovel.id)) return imovelDuplicado()
      imovel.nome = limpo
      if (ordem !== undefined) imovel.ordem = ordem
      return HttpResponse.json(publicoImovel(imovel))
    }),
  ),

  http.delete(
    `${API_URL}/imoveis/:id`,
    autenticado(({ params }, u) => {
      const indice = banco.imoveis.findIndex((i) => i.id === idDe(params) && i.usuarioId === u.id)
      if (indice < 0) return naoEncontrado('Imóvel')
      if (banco.pagamentos.some((p) => p.imovelId === idDe(params))) {
        return erro(
          409,
          'REFERENCIA_INVALIDA',
          'Este imóvel tem pagamentos ligados. Remova os pagamentos ou troque o imóvel deles antes.',
        )
      }
      banco.imoveis.splice(indice, 1)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    `${API_URL}/pagamentos`,
    autenticado(({ request }, u) => {
      const q = new URL(request.url).searchParams
      return HttpResponse.json(
        listarPagamentos(u.id, {
          inicio: q.get('inicio'),
          fim: q.get('fim'),
          status: q.get('status'),
          categoriaId: q.get('categoriaId'),
          imovelId: q.get('imovelId'),
        }),
      )
    }),
  ),

  http.get(
    `${API_URL}/pagamentos/:id`,
    autenticado(({ params }, u) => {
      const p = doUsuario(u.id, idDe(params))
      if (!p) return naoEncontrado('Pagamento')
      const comprovantes = banco.comprovantes.filter((c) => c.pagamentoId === p.id).map(publicoComprovante)
      return HttpResponse.json({ ...paraResposta(p), comprovantes })
    }),
  ),

  http.post(
    `${API_URL}/pagamentos`,
    autenticado(async ({ request }, u) => {
      const corpo = (await request.json()) as PagamentoCriacao
      const dados = comPadroes(corpo)
      const invalido = validar(dados, u.id)
      if (invalido) return invalido

      if (corpo.parcelamento) {
        const total = corpo.parcelamento.totalParcelas
        if (!Number.isInteger(total) || total < 2 || total > 120)
          return erro(400, 'VALIDACAO', 'parcelamento.totalParcelas: Use de 2 a 120 parcelas.')
        if (dados.recorrencia !== 'nenhuma')
          return erro(400, 'VALIDACAO', 'recorrencia: Pagamento parcelado não pode ser recorrente.')
        if (dados.status !== 'pendente')
          return erro(400, 'VALIDACAO', 'status: As parcelas são criadas como pendentes.')
        const grupo = crypto.randomUUID()
        const parcelas = Array.from({ length: total }, (_, i) =>
          novoPagamento({
            ...gravaveis(dados),
            usuarioId: u.id,
            vencimento: somar(dados.vencimento, i, 'months'),
            parcelamentoGrupoId: grupo,
            parcelaAtual: i + 1,
            parcelaTotal: total,
          }),
        )
        banco.pagamentos.push(...parcelas)
        return HttpResponse.json(parcelas.map(paraResposta), { status: 201 })
      }

      const pagamento = novoPagamento({ ...gravaveis(dados), usuarioId: u.id })
      banco.pagamentos.push(pagamento)
      garantirProxima(pagamento)
      return HttpResponse.json(paraResposta(pagamento), { status: 201 })
    }),
  ),

  http.put(
    `${API_URL}/pagamentos/:id`,
    autenticado(async ({ request, params }, u) => {
      const p = doUsuario(u.id, idDe(params))
      if (!p) return naoEncontrado('Pagamento')
      if (p.cartaoId) return faturaAutomatica()
      if (p.membroId) {
        // Conta da equipe: só valor (pode ficar a definir), data, situação e observações.
        const d = comPadroes((await request.json()) as PagamentoEdicao)
        const valor = d.valorCentavos ?? null
        if (valor !== null && (!Number.isInteger(valor) || valor <= 0))
          return erro(400, 'VALIDACAO', 'valorCentavos: O valor precisa ser maior que zero.')
        if (d.status === 'pago' && valor === null)
          return erro(400, 'VALIDACAO', 'valorCentavos: Informe o valor pago.')
        if (d.vencimento !== p.vencimento) banco.dispensas.push({ membroId: p.membroId, vencimento: p.vencimento })
        Object.assign(p, {
          valorCentavos: valor,
          vencimento: d.vencimento,
          status: d.status,
          dataPagamento: d.dataPagamento,
          observacoes: d.observacoes,
          atualizadoEm: agoraISO(),
        })
        return HttpResponse.json(paraResposta(p))
      }
      const dados = comPadroes((await request.json()) as PagamentoEdicao)
      const invalido = validar(dados, u.id)
      if (invalido) return invalido
      if (p.parcelamentoGrupoId && dados.recorrencia !== 'nenhuma')
        return erro(400, 'VALIDACAO', 'recorrencia: parcela não pode ser recorrente.')
      Object.assign(p, gravaveis(dados), { atualizadoEm: agoraISO() })
      garantirProxima(p)
      return HttpResponse.json(paraResposta(p))
    }),
  ),

  http.patch(
    `${API_URL}/pagamentos/:id/pagar`,
    autenticado(async ({ request, params }, u) => {
      const p = doUsuario(u.id, idDe(params))
      if (!p) return naoEncontrado('Pagamento')
      if (p.status === 'pago') return erro(409, 'JA_PAGO', 'Este pagamento já está pago.')
      const corpo = (await request.json().catch(() => ({}))) as { dataPagamento?: string; valorCentavos?: number }
      // Conta da equipe pode receber o valor na hora de pagar (obrigatório se estava a definir).
      const valor = p.membroId ? (corpo.valorCentavos ?? p.valorCentavos) : p.valorCentavos
      if (valor === null) return erro(400, 'VALIDACAO', 'valorCentavos: Informe o valor pago.')
      Object.assign(p, {
        status: 'pago',
        valorCentavos: valor,
        dataPagamento: corpo.dataPagamento ?? hojeISO(),
        atualizadoEm: agoraISO(),
      })
      garantirProxima(p)
      return HttpResponse.json(paraResposta(p))
    }),
  ),

  http.delete(
    `${API_URL}/pagamentos/:id`,
    autenticado(({ params }, u) => {
      const indice = banco.pagamentos.findIndex((p) => p.id === idDe(params) && p.usuarioId === u.id)
      if (indice < 0) return naoEncontrado('Pagamento')
      if (banco.pagamentos[indice].cartaoId) return faturaAutomatica()
      const { membroId, vencimento } = banco.pagamentos[indice]
      // Conta da equipe apagada não é criada de novo naquele dia.
      if (membroId) banco.dispensas.push({ membroId, vencimento })
      const [apagado] = banco.pagamentos.splice(indice, 1)
      banco.comprovantes = banco.comprovantes.filter((c) => c.pagamentoId !== apagado.id)
      // ON DELETE SET NULL de recorrencia_origem_id
      banco.pagamentos.forEach((p) => {
        if (p.recorrenciaOrigemId === apagado.id) p.recorrenciaOrigemId = null
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.post(
    `${API_URL}/pagamentos/:id/comprovantes`,
    autenticado(async ({ request, params }, u) => {
      // Como o multer: tamanho e campo errado vêm antes de tudo.
      const upload = await lerUpload(request)
      if ('problema' in upload) return upload.problema
      const p = doUsuario(u.id, idDe(params))
      if (!p) return naoEncontrado('Pagamento')
      if (!upload.arquivo) return erro(400, 'VALIDACAO', 'arquivo: envie o arquivo no campo "arquivo".')
      const tipo = detectarTipo(upload.arquivo.bytes)
      if (!tipo) return tipoNaoAceito()
      if (banco.comprovantes.filter((c) => c.pagamentoId === p.id).length >= MAXIMO_COMPROVANTES)
        return erro(409, 'LIMITE_ANEXOS', `Cada conta pode ter no máximo ${MAXIMO_COMPROVANTES} comprovantes.`)
      const comprovante: ComprovanteMock = {
        id: crypto.randomUUID(),
        pagamentoId: p.id,
        nomeOriginal: nomeSeguro(upload.arquivo.nomeArquivo ?? '', tipo.extensao),
        mimeType: tipo.mime,
        tamanhoBytes: upload.arquivo.bytes.byteLength,
        bytes: upload.arquivo.bytes,
        criadoEm: agoraISO(),
      }
      banco.comprovantes.push(comprovante)
      return HttpResponse.json(publicoComprovante(comprovante), { status: 201 })
    }),
  ),

  http.get(
    `${API_URL}/pagamentos/:id/comprovantes/:comprovanteId`,
    autenticado(({ params }, u) => {
      const p = doUsuario(u.id, idDe(params))
      const c = p && banco.comprovantes.find((x) => x.id === params.comprovanteId && x.pagamentoId === p.id)
      return c ? respostaArquivo(c) : naoEncontrado('Comprovante')
    }),
  ),

  http.delete(
    `${API_URL}/pagamentos/:id/comprovantes/:comprovanteId`,
    autenticado(({ params }, u) => {
      const p = doUsuario(u.id, idDe(params))
      const indice = p ? banco.comprovantes.findIndex((x) => x.id === params.comprovanteId && x.pagamentoId === p.id) : -1
      if (indice < 0) return naoEncontrado('Comprovante')
      banco.comprovantes.splice(indice, 1)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    `${API_URL}/relatorios/gastos`,
    autenticado(({ request }, u) => {
      const q = new URL(request.url).searchParams
      const inicio = q.get('inicio') ?? ''
      const fim = q.get('fim') ?? ''
      const agruparPor = q.get('agruparPor') === 'categoria' ? 'categoria' : 'imovel'
      if (!inicio || !fim) return erro(400, 'VALIDACAO', 'inicio: Data inválida: use o formato AAAA-MM-DD.')
      if (inicio > fim) return erro(400, 'VALIDACAO', 'fim: O início precisa ser anterior ou igual ao fim.')
      garantirContasEquipe(u.id)

      const noPeriodo = (d: string | null) => d !== null && d >= inicio && d <= fim
      const grupos = new Map<string | null, { pagoCentavos: number; previstoCentavos: number }>()
      for (const p of banco.pagamentos.filter((x) => x.usuarioId === u.id)) {
        const pago = p.status === 'pago' && noPeriodo(p.dataPagamento)
        const previsto = p.status === 'pendente' && noPeriodo(p.vencimento)
        if (!pago && !previsto) continue
        // Sem categoria: equipe e faturas de cartão viram grupos próprios (id null, como no back-end).
        const chave =
          agruparPor === 'categoria'
            ? (p.categoriaId ?? (p.membroId ? 'Salários equipe' : 'Cartão de crédito'))
            : p.imovelId
        const g = grupos.get(chave) ?? { pagoCentavos: 0, previstoCentavos: 0 }
        if (pago) g.pagoCentavos += p.valorCentavos ?? 0
        if (previsto) g.previstoCentavos += p.valorCentavos ?? 0
        grupos.set(chave, g)
      }

      const referencia = agruparPor === 'categoria' ? categoriasDo(u.id) : imoveisDo(u.id).map(publicoImovel)
      const itens = [...grupos.entries()]
        .map(([id, valores]) => {
          const ref = referencia.find((r) => r.id === id)
          if (ref) return { id, nome: ref.nome, ordem: ref.ordem, ...valores }
          const nome = agruparPor === 'categoria' ? id! : 'Sem imóvel'
          return { id: null, nome, ordem: Infinity, ...valores }
        })
        .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
        .map(({ ordem: _o, ...item }) => item)

      return HttpResponse.json({
        inicio,
        fim,
        agruparPor,
        totalPagoCentavos: itens.reduce((s, i) => s + i.pagoCentavos, 0),
        totalPrevistoCentavos: itens.reduce((s, i) => s + i.previstoCentavos, 0),
        itens,
      })
    }),
  ),
]
