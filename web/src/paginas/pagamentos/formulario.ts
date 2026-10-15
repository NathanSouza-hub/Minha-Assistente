// Formulário de pagamento: o que a pessoa digita (textos) ↔ corpo da API (centavos, nulls).
// Regras espelhando src/modules/pagamentos/schema.js do back-end.
import { z } from 'zod'
import { hojeISO } from '@/lib/datas'
import { paraCentavos } from '@/lib/dinheiro'
import type { Pagamento, PagamentoCriacao, PagamentoEdicao } from '@/lib/tipos'

export type Repeticao = 'nenhuma' | 'mensal' | 'anual' | 'parcelado'

const data = (mensagem: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, mensagem)

export const esquemaPagamento = z
  .object({
    descricao: z.string().trim().min(1, 'Informe a descrição.').max(200, 'Descrição longa demais.'),
    valor: z.string().refine((v) => (paraCentavos(v) ?? 0) > 0, 'Digite o valor, por exemplo 150,00.'),
    vencimento: data('Informe o vencimento.'),
    categoriaId: z.string().min(1, 'Escolha a categoria.'),
    imovelId: z.string(),
    repeticao: z.enum(['nenhuma', 'mensal', 'anual', 'parcelado']),
    totalParcelas: z.string(),
    jaPago: z.boolean(),
    dataPagamento: z.string(),
    observacoes: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.repeticao === 'parcelado') {
      const n = Number(v.totalParcelas)
      if (!Number.isInteger(n) || n < 2 || n > 120) {
        ctx.addIssue({ code: 'custom', path: ['totalParcelas'], message: 'Use de 2 a 120 parcelas.' })
      }
    }
    if (v.jaPago && v.repeticao !== 'parcelado' && !/^\d{4}-\d{2}-\d{2}$/.test(v.dataPagamento)) {
      ctx.addIssue({ code: 'custom', path: ['dataPagamento'], message: 'Informe a data do pagamento.' })
    }
  })

export type DadosPagamento = z.infer<typeof esquemaPagamento>

/** Nomes da API → campos do formulário, para distribuir erros VALIDACAO do back-end. */
export const camposDaApi = {
  valorCentavos: 'valor',
  recorrencia: 'repeticao',
  'parcelamento.totalParcelas': 'totalParcelas',
  status: 'jaPago',
} as const

const centavosParaTexto = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',')

export function valoresIniciais(
  pagamento?: Pagamento,
  vencimentoPadrao = hojeISO(),
  categoriaPadrao = '',
): DadosPagamento {
  if (!pagamento) {
    return {
      descricao: '',
      valor: '',
      vencimento: vencimentoPadrao,
      categoriaId: categoriaPadrao,
      imovelId: '',
      repeticao: 'nenhuma',
      totalParcelas: '2',
      jaPago: false,
      dataPagamento: hojeISO(),
      observacoes: '',
    }
  }
  return {
    descricao: pagamento.descricao,
    valor: centavosParaTexto(pagamento.valorCentavos),
    vencimento: pagamento.vencimento,
    categoriaId: pagamento.categoriaId,
    imovelId: pagamento.imovelId ?? '',
    repeticao: pagamento.recorrencia,
    totalParcelas: '2',
    jaPago: pagamento.status === 'pago',
    dataPagamento: pagamento.dataPagamento ?? hojeISO(),
    observacoes: pagamento.observacoes ?? '',
  }
}

export function paraCorpo(d: DadosPagamento): PagamentoCriacao {
  const parcelado = d.repeticao === 'parcelado'
  const pago = d.jaPago && !parcelado
  return {
    descricao: d.descricao.trim(),
    categoriaId: d.categoriaId,
    imovelId: d.imovelId || null,
    valorCentavos: paraCentavos(d.valor)!,
    vencimento: d.vencimento,
    status: pago ? 'pago' : 'pendente',
    dataPagamento: pago ? d.dataPagamento : null,
    recorrencia: d.repeticao === 'parcelado' ? 'nenhuma' : d.repeticao,
    observacoes: d.observacoes.trim() || null,
    ...(parcelado && { parcelamento: { totalParcelas: Number(d.totalParcelas) } }),
  }
}

/** Pagamento da API → corpo completo do PUT (para editar um campo só, como no "Desfazer"). */
export const paraEdicao = (p: Pagamento): PagamentoEdicao => ({
  descricao: p.descricao,
  categoriaId: p.categoriaId,
  imovelId: p.imovelId,
  valorCentavos: p.valorCentavos,
  vencimento: p.vencimento,
  status: p.status,
  dataPagamento: p.dataPagamento,
  recorrencia: p.recorrencia,
  observacoes: p.observacoes,
})
