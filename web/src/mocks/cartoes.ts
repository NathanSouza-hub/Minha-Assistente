// Cartões de crédito — regras espelhando src/modules/cartoes/service.js do back-end.
import { http, HttpResponse } from 'msw'
import { DateTime } from 'luxon'
import { API_URL } from '@/lib/api'
import { hojeISO } from '@/lib/datas'
import { datasDaCompetencia, parcelasDaCompra, primeiraCompetencia, somarMesesCompetencia } from '@/lib/fatura'
import type { Cartao, CartaoCorpo, CompraCartao, CompraCartaoCorpo, CorCartao, Fatura, SituacaoFatura } from '@/lib/tipos'
import { agoraISO, banco, novoPagamento, type CartaoMock, type CompraCartaoMock } from './banco'
import { autenticado, erro, naoEncontrado } from './util'

const CORES: CorCartao[] = ['azul', 'roxo', 'verde', 'laranja', 'vermelho', 'grafite']

const doUsuario = (usuarioId: string, id: unknown) =>
  banco.cartoes.find((c) => c.id === String(id) && c.usuarioId === usuarioId)

const comprasDo = (cartaoId: string) =>
  banco.comprasCartao
    .filter((c) => c.cartaoId === cartaoId)
    .sort((a, b) => a.dataCompra.localeCompare(b.dataCompra) || a.criadoEm.localeCompare(b.criadoEm))

const parcelasDo = (cartao: CartaoMock) =>
  comprasDo(cartao.id).flatMap((compra) => parcelasDaCompra(cartao, compra).map((p) => ({ compra, ...p })))

function somarPorCompetencia(parcelas: { competencia: string; valorCentavos: number }[]) {
  const somas = new Map<string, number>()
  for (const p of parcelas) somas.set(p.competencia, (somas.get(p.competencia) ?? 0) + p.valorCentavos)
  return somas
}

const contasDo = (cartaoId: string) =>
  new Map(banco.pagamentos.filter((p) => p.cartaoId === cartaoId).map((p) => [p.competencia!, p]))

const situacao = (fechamento: string, pago: boolean): SituacaoFatura =>
  pago ? 'paga' : hojeISO() >= fechamento ? 'fechada' : 'aberta'

const nomeDoMes = (competencia: string) =>
  DateTime.fromISO(competencia).setLocale('pt-BR').toFormat("LLLL 'de' yyyy")

class FaturaPaga extends Error {}

/**
 * Como sincronizar() do back-end: deixa as contas de fatura iguais às compras. Fatura paga não
 * muda; se mudaria, lança FaturaPaga (quem chama desfaz a operação).
 */
function sincronizar(cartao: CartaoMock) {
  const somas = somarPorCompetencia(parcelasDo(cartao))
  const contas = contasDo(cartao.id)
  for (const [competencia, conta] of contas) {
    if (conta.status === 'pago' && conta.valorCentavos !== (somas.get(competencia) ?? 0))
      throw new FaturaPaga(`A mudança mexe na fatura de ${nomeDoMes(competencia)}, que já foi paga.`)
  }
  for (const competencia of new Set([...somas.keys(), ...contas.keys()])) {
    const total = somas.get(competencia) ?? 0
    const conta = contas.get(competencia)
    if (conta?.status === 'pago') continue
    const { vencimento } = datasDaCompetencia(cartao, competencia)
    if (!conta) {
      if (total > 0)
        banco.pagamentos.push(
          novoPagamento({
            usuarioId: cartao.usuarioId,
            descricao: `Fatura ${cartao.nome}`,
            categoriaId: null,
            valorCentavos: total,
            vencimento,
            cartaoId: cartao.id,
            competencia,
          }),
        )
    } else if (total === 0) {
      banco.pagamentos.splice(banco.pagamentos.indexOf(conta), 1)
    } else {
      Object.assign(conta, { valorCentavos: total, vencimento, descricao: `Fatura ${cartao.nome}`, atualizadoEm: agoraISO() })
    }
  }
}

/** Faz a mudança e sincroniza (como a transação do back-end): fatura paga afetada desfaz tudo. */
function comSincronizacao(cartao: CartaoMock, mudar: () => void, responder: () => Response): Response {
  const copia = {
    cartoes: structuredClone(banco.cartoes),
    compras: structuredClone(banco.comprasCartao),
    pagamentos: structuredClone(banco.pagamentos),
  }
  mudar()
  try {
    sincronizar(cartao)
    return responder()
  } catch (e) {
    if (!(e instanceof FaturaPaga)) throw e
    banco.cartoes.splice(0, Infinity, ...copia.cartoes)
    banco.comprasCartao.splice(0, Infinity, ...copia.compras)
    banco.pagamentos.splice(0, Infinity, ...copia.pagamentos)
    return erro(409, 'FATURA_PAGA', e.message)
  }
}

function faturaAtual(cartao: CartaoMock, somas: Map<string, number>, contas: ReturnType<typeof contasDo>) {
  const hoje = hojeISO()
  const aberta = primeiraCompetencia(cartao, hoje)
  let competencia = `${hoje.slice(0, 7)}-01`
  for (;;) {
    const pago = contas.get(competencia)?.status === 'pago'
    if (!pago && ((somas.get(competencia) ?? 0) > 0 || competencia >= aberta)) break
    competencia = somarMesesCompetencia(competencia, 1)
  }
  const { fechamento, vencimento } = datasDaCompetencia(cartao, competencia)
  return { competencia, totalCentavos: somas.get(competencia) ?? 0, vencimento, situacao: situacao(fechamento, false) }
}

function paraResposta(cartao: CartaoMock): Cartao {
  const { usuarioId: _u, ...resto } = cartao
  const parcelas = parcelasDo(cartao)
  const contas = contasDo(cartao.id)
  const naoPagas = parcelas.filter((p) => contas.get(p.competencia)?.status !== 'pago')
  return {
    ...resto,
    limiteDisponivelCentavos:
      cartao.limiteCentavos === null ? null : cartao.limiteCentavos - naoPagas.reduce((s, p) => s + p.valorCentavos, 0),
    faturaAtual: faturaAtual(cartao, somarPorCompetencia(parcelas), contas),
  }
}

const compraParaResposta = (cartao: CartaoMock, compra: CompraCartaoMock): CompraCartao => {
  const { criadoEm: _c, ...resto } = compra
  return { ...resto, competencias: parcelasDaCompra(cartao, compra).map((p) => p.competencia) }
}

const cartoesDo = (usuarioId: string) =>
  banco.cartoes
    .filter((c) => c.usuarioId === usuarioId)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))

/** Validações principais do schema.js; devolve o corpo limpo ou a resposta de erro. */
function validarCartao(d: Partial<CartaoCorpo>, usuarioId: string, exceto?: string) {
  const nome = d.nome?.trim() ?? ''
  const problemas: string[] = []
  if (!nome) problemas.push('nome: Informe o nome do cartão.')
  if (nome.length > 40) problemas.push('nome: Nome longo demais.')
  if (d.final != null && !/^\d{4}$/.test(d.final)) problemas.push('final: O final do cartão tem 4 dígitos.')
  if (d.cor !== undefined && !CORES.includes(d.cor)) problemas.push('cor: Cor inválida.')
  for (const [campo, rotulo] of [
    ['diaFechamento', 'fechamento'],
    ['diaVencimento', 'vencimento'],
  ] as const) {
    const dia = d[campo]
    if (!Number.isInteger(dia) || dia! < 1 || dia! > 31) problemas.push(`${campo}: O dia de ${rotulo} vai de 1 a 31.`)
  }
  if (d.limiteCentavos != null && (!Number.isInteger(d.limiteCentavos) || d.limiteCentavos <= 0))
    problemas.push('limiteCentavos: O valor precisa ser maior que zero.')
  if (problemas.length) return { problema: erro(400, 'VALIDACAO', problemas.join('; ')) }
  if (banco.cartoes.some((c) => c.usuarioId === usuarioId && c.id !== exceto && c.nome.toLowerCase() === nome.toLowerCase()))
    return { problema: erro(409, 'CARTAO_DUPLICADO', 'Você já tem um cartão com esse nome.') }
  return {
    limpo: {
      nome,
      final: d.final ?? null,
      cor: d.cor ?? 'azul',
      diaFechamento: d.diaFechamento!,
      diaVencimento: d.diaVencimento!,
      limiteCentavos: d.limiteCentavos ?? null,
      ...(d.ordem !== undefined && { ordem: d.ordem }),
    },
  }
}

function validarCompra(d: Partial<CompraCartaoCorpo>, usuarioId: string) {
  const problemas: string[] = []
  const descricao = d.descricao?.trim() ?? ''
  const parcelas = d.parcelas ?? 1
  if (!descricao) problemas.push('descricao: Informe a descrição.')
  if (!Number.isInteger(d.valorTotalCentavos) || d.valorTotalCentavos! <= 0)
    problemas.push('valorTotalCentavos: O valor precisa ser maior que zero.')
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48) problemas.push('parcelas: Use de 1 a 48 parcelas.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataCompra ?? '')) problemas.push('dataCompra: Data inválida.')
  if (problemas.length) return { problema: erro(400, 'VALIDACAO', problemas.join('; ')) }
  if (d.categoriaId && !banco.categorias.some((c) => c.id === d.categoriaId && c.usuarioId === usuarioId))
    return { problema: erro(400, 'VALIDACAO', 'categoriaId: categoria não encontrada.') }
  return {
    limpo: {
      descricao,
      valorTotalCentavos: d.valorTotalCentavos!,
      parcelas,
      dataCompra: d.dataCompra!,
      categoriaId: d.categoriaId ?? null,
      observacoes: d.observacoes?.trim() || null,
    },
  }
}

const manter = <T,>(lista: T[], fica: (x: T) => boolean) => lista.splice(0, Infinity, ...lista.filter(fica))

export const handlersCartoes = [
  http.get(
    `${API_URL}/cartoes`,
    autenticado((_ctx, u) => HttpResponse.json(cartoesDo(u.id).map(paraResposta))),
  ),

  http.post(
    `${API_URL}/cartoes`,
    autenticado(async ({ request }, u) => {
      const { limpo, problema } = validarCartao((await request.json()) as CartaoCorpo, u.id)
      if (problema) return problema
      const ordem = limpo.ordem ?? Math.max(0, ...cartoesDo(u.id).map((c) => c.ordem)) + 1
      const cartao: CartaoMock = { id: crypto.randomUUID(), usuarioId: u.id, ...limpo, ordem }
      banco.cartoes.push(cartao)
      return HttpResponse.json(paraResposta(cartao), { status: 201 })
    }),
  ),

  http.get(
    `${API_URL}/cartoes/:id`,
    autenticado(({ params }, u) => {
      const cartao = doUsuario(u.id, params.id)
      return cartao ? HttpResponse.json(paraResposta(cartao)) : naoEncontrado('Cartão')
    }),
  ),

  http.put(
    `${API_URL}/cartoes/:id`,
    autenticado(async ({ request, params }, u) => {
      const cartao = doUsuario(u.id, params.id)
      if (!cartao) return naoEncontrado('Cartão')
      const { limpo, problema } = validarCartao((await request.json()) as CartaoCorpo, u.id, cartao.id)
      if (problema) return problema
      return comSincronizacao(
        cartao,
        () => Object.assign(cartao, limpo),
        () => HttpResponse.json(paraResposta(cartao)),
      )
    }),
  ),

  http.delete(
    `${API_URL}/cartoes/:id`,
    autenticado(({ params }, u) => {
      const cartao = doUsuario(u.id, params.id)
      if (!cartao) return naoEncontrado('Cartão')
      if (banco.pagamentos.some((p) => p.cartaoId === cartao.id && p.status === 'pago'))
        return erro(409, 'REFERENCIA_INVALIDA', 'O cartão tem faturas pagas no histórico.')
      manter(banco.pagamentos, (p) => p.cartaoId !== cartao.id)
      manter(banco.comprasCartao, (c) => c.cartaoId !== cartao.id)
      manter(banco.cartoes, (c) => c.id !== cartao.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    `${API_URL}/cartoes/:id/faturas/:competencia`,
    autenticado(({ params }, u) => {
      const texto = String(params.competencia)
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(texto))
        return erro(400, 'VALIDACAO', 'competencia: Competência inválida: use AAAA-MM.')
      const cartao = doUsuario(u.id, params.id)
      if (!cartao) return naoEncontrado('Cartão')
      const competencia = `${texto}-01`
      const parcelas = parcelasDo(cartao).filter((p) => p.competencia === competencia)
      const conta = contasDo(cartao.id).get(competencia)
      const { fechamento, vencimento } = datasDaCompetencia(cartao, competencia)
      const fatura: Fatura = {
        competencia,
        fechamento,
        vencimento,
        situacao: situacao(fechamento, conta?.status === 'pago'),
        totalCentavos: parcelas.reduce((s, p) => s + p.valorCentavos, 0),
        pagamentoId: conta?.id ?? null,
        parcelas: parcelas.map(({ compra, parcela, totalParcelas, valorCentavos }) => ({
          compraId: compra.id,
          descricao: compra.descricao,
          categoriaId: compra.categoriaId,
          categoriaNome: banco.categorias.find((c) => c.id === compra.categoriaId)?.nome ?? null,
          dataCompra: compra.dataCompra,
          parcela,
          totalParcelas,
          valorCentavos,
        })),
      }
      return HttpResponse.json(fatura)
    }),
  ),

  http.post(
    `${API_URL}/cartoes/:id/compras`,
    autenticado(async ({ request, params }, u) => {
      const cartao = doUsuario(u.id, params.id)
      if (!cartao) return naoEncontrado('Cartão')
      const { limpo, problema } = validarCompra((await request.json()) as CompraCartaoCorpo, u.id)
      if (problema) return problema
      const compra: CompraCartaoMock = { id: crypto.randomUUID(), cartaoId: cartao.id, criadoEm: agoraISO(), ...limpo }
      return comSincronizacao(
        cartao,
        () => banco.comprasCartao.push(compra),
        () => HttpResponse.json(compraParaResposta(cartao, compra), { status: 201 }),
      )
    }),
  ),

  http.get(
    `${API_URL}/cartoes/:id/compras/:compraId`,
    autenticado(({ params }, u) => {
      const cartao = doUsuario(u.id, params.id)
      if (!cartao) return naoEncontrado('Cartão')
      const compra = banco.comprasCartao.find((c) => c.id === params.compraId && c.cartaoId === cartao.id)
      return compra ? HttpResponse.json(compraParaResposta(cartao, compra)) : naoEncontrado('Compra', { feminino: true })
    }),
  ),

  http.put(
    `${API_URL}/cartoes/:id/compras/:compraId`,
    autenticado(async ({ request, params }, u) => {
      const cartao = doUsuario(u.id, params.id)
      if (!cartao) return naoEncontrado('Cartão')
      const compra = banco.comprasCartao.find((c) => c.id === params.compraId && c.cartaoId === cartao.id)
      if (!compra) return naoEncontrado('Compra', { feminino: true })
      const { limpo, problema } = validarCompra((await request.json()) as CompraCartaoCorpo, u.id)
      if (problema) return problema
      return comSincronizacao(
        cartao,
        () => Object.assign(compra, limpo),
        () => HttpResponse.json(compraParaResposta(cartao, compra)),
      )
    }),
  ),

  http.delete(
    `${API_URL}/cartoes/:id/compras/:compraId`,
    autenticado(({ params }, u) => {
      const cartao = doUsuario(u.id, params.id)
      if (!cartao) return naoEncontrado('Cartão')
      const compra = banco.comprasCartao.find((c) => c.id === params.compraId && c.cartaoId === cartao.id)
      if (!compra) return naoEncontrado('Compra', { feminino: true })
      return comSincronizacao(
        cartao,
        () => manter(banco.comprasCartao, (c) => c !== compra),
        () => new HttpResponse(null, { status: 204 }),
      )
    }),
  ),
]
