// Equipe — regras espelhando src/modules/equipe do back-end: o app garante a conta de cada dia de
// pagamento das pessoas ativas no mês atual e no seguinte (a partir de `desde`, sem as dispensadas).
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { deDataISO, hojeISO } from '@/lib/datas'
import type { FormaPagamento, MembroEquipe, MembroEquipeCorpo } from '@/lib/tipos'
import { banco, novoPagamento, type MembroMock } from './banco'
import { autenticado, erro, naoEncontrado } from './util'

const FORMAS: FormaPagamento[] = ['mensal', 'plantao', 'honorario']

/** Como garantirContas() do back-end (src/modules/equipe/contas.js). */
export function garantirContasEquipe(usuarioId: string, hoje = hojeISO()) {
  const inicio = deDataISO(hoje).startOf('month')
  for (const m of banco.membros.filter((x) => x.usuarioId === usuarioId && x.ativo)) {
    for (const d of m.dias) {
      for (const mes of [inicio, inicio.plus({ months: 1 })]) {
        const vencimento = mes.set({ day: Math.min(d.dia, mes.daysInMonth!) }).toISODate()!
        if (vencimento < d.desde) continue
        if (banco.dispensas.some((x) => x.membroId === m.id && x.vencimento === vencimento)) continue
        if (banco.pagamentos.some((p) => p.membroId === m.id && p.vencimento === vencimento)) continue
        banco.pagamentos.push(
          novoPagamento({
            usuarioId,
            descricao: m.nome,
            categoriaId: null,
            valorCentavos: d.valorPrevistoCentavos,
            vencimento,
            membroId: m.id,
          }),
        )
      }
    }
  }
}

/** Apaga as contas pendentes da pessoa de hoje em diante (e as dispensas desse período). */
function apagarFuturas(membroId: string) {
  const hoje = hojeISO()
  const ficam = banco.pagamentos.filter(
    (p) => !(p.membroId === membroId && p.status === 'pendente' && p.vencimento >= hoje),
  )
  banco.pagamentos.splice(0, Infinity, ...ficam)
  const dispensas = banco.dispensas.filter((x) => !(x.membroId === membroId && x.vencimento >= hoje))
  banco.dispensas.splice(0, Infinity, ...dispensas)
}

const paraResposta = ({ usuarioId: _u, dias, ...m }: MembroMock): MembroEquipe => ({
  ...m,
  dias: dias.map(({ dia, valorPrevistoCentavos }) => ({ dia, valorPrevistoCentavos })),
})

const membrosDo = (usuarioId: string) =>
  banco.membros
    .filter((m) => m.usuarioId === usuarioId)
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))

/** Validações principais do schema.js; devolve o corpo limpo ou a resposta de erro. */
function validar(d: Partial<MembroEquipeCorpo>, usuarioId: string, exceto?: string) {
  const nome = d.nome?.trim() ?? ''
  const dias = d.dias ?? []
  const problemas: string[] = []
  if (!nome) problemas.push('nome: Informe o nome.')
  if (!FORMAS.includes(d.formaPagamento as FormaPagamento)) problemas.push('formaPagamento: Escolha a forma de receber.')
  if (!dias.length) problemas.push('dias: Informe pelo menos um dia de pagamento.')
  if (dias.some((x) => !Number.isInteger(x.dia) || x.dia < 1 || x.dia > 31))
    problemas.push('dias: O dia do pagamento vai de 1 a 31.')
  if (new Set(dias.map((x) => x.dia)).size !== dias.length) problemas.push('dias: Há dias de pagamento repetidos.')
  if (problemas.length) return { problema: erro(400, 'VALIDACAO', problemas.join('; ')) }
  if (banco.membros.some((m) => m.usuarioId === usuarioId && m.id !== exceto && m.nome.toLowerCase() === nome.toLowerCase()))
    return { problema: erro(409, 'MEMBRO_DUPLICADO', 'Já existe uma pessoa com esse nome na equipe.') }
  return {
    limpo: {
      nome,
      funcao: d.funcao?.trim() || null,
      formaPagamento: d.formaPagamento as FormaPagamento,
      chavePix: d.chavePix?.trim() || null,
      ativo: d.ativo ?? true,
      dias: [...dias]
        .sort((a, b) => a.dia - b.dia)
        .map((x) => ({ dia: x.dia, valorPrevistoCentavos: x.valorPrevistoCentavos ?? null, desde: hojeISO() })),
    },
  }
}

const mesmosDias = (a: MembroMock['dias'], b: MembroMock['dias']) =>
  a.length === b.length &&
  a.every((d, i) => d.dia === b[i].dia && d.valorPrevistoCentavos === b[i].valorPrevistoCentavos)

export const handlersEquipe = [
  http.get(
    `${API_URL}/equipe`,
    autenticado((_ctx, u) => HttpResponse.json(membrosDo(u.id).map(paraResposta))),
  ),

  http.post(
    `${API_URL}/equipe`,
    autenticado(async ({ request }, u) => {
      const { limpo, problema } = validar((await request.json()) as MembroEquipeCorpo, u.id)
      if (problema) return problema
      const membro: MembroMock = { id: crypto.randomUUID(), usuarioId: u.id, ...limpo }
      banco.membros.push(membro)
      garantirContasEquipe(u.id)
      return HttpResponse.json(paraResposta(membro), { status: 201 })
    }),
  ),

  http.get(
    `${API_URL}/equipe/:id`,
    autenticado(({ params }, u) => {
      const membro = banco.membros.find((m) => m.id === params.id && m.usuarioId === u.id)
      return membro ? HttpResponse.json(paraResposta(membro)) : naoEncontrado('Pessoa', { feminino: true })
    }),
  ),

  http.put(
    `${API_URL}/equipe/:id`,
    autenticado(async ({ request, params }, u) => {
      const membro = banco.membros.find((m) => m.id === params.id && m.usuarioId === u.id)
      if (!membro) return naoEncontrado('Pessoa', { feminino: true })
      const { limpo, problema } = validar((await request.json()) as MembroEquipeCorpo, u.id, membro.id)
      if (problema) return problema
      const diasMudaram = !mesmosDias(membro.dias, limpo.dias)
      const ativoMudou = membro.ativo !== limpo.ativo
      const reativou = !membro.ativo && limpo.ativo
      const nomeMudou = membro.nome !== limpo.nome
      Object.assign(membro, { ...limpo, dias: diasMudaram ? limpo.dias : membro.dias })
      if (!diasMudaram && reativou) membro.dias.forEach((d) => (d.desde = hojeISO()))
      if (diasMudaram || ativoMudou) apagarFuturas(membro.id)
      if (nomeMudou)
        banco.pagamentos
          .filter((p) => p.membroId === membro.id && p.status === 'pendente')
          .forEach((p) => (p.descricao = membro.nome))
      garantirContasEquipe(u.id)
      return HttpResponse.json(paraResposta(membro))
    }),
  ),

  http.delete(
    `${API_URL}/equipe/:id`,
    autenticado(({ params }, u) => {
      const membro = banco.membros.find((m) => m.id === params.id && m.usuarioId === u.id)
      if (!membro) return naoEncontrado('Pessoa', { feminino: true })
      if (banco.pagamentos.some((p) => p.membroId === membro.id && p.status === 'pago'))
        return erro(
          409,
          'REFERENCIA_INVALIDA',
          'Essa pessoa já recebeu pagamentos. Desative em vez de excluir, para manter o histórico.',
        )
      banco.pagamentos.splice(0, Infinity, ...banco.pagamentos.filter((p) => p.membroId !== membro.id))
      banco.dispensas.splice(0, Infinity, ...banco.dispensas.filter((x) => x.membroId !== membro.id))
      banco.membros.splice(banco.membros.indexOf(membro), 1)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
