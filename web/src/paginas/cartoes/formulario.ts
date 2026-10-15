// Formulários de cartão e de compra: o que a pessoa digita (textos) ↔ corpo da API.
// Regras espelhando src/modules/cartoes/schema.js do back-end.
import { z } from 'zod'
import { hojeISO } from '@/lib/datas'
import { paraCentavos } from '@/lib/dinheiro'
import type { Cartao, CartaoCorpo, CompraCartao, CompraCartaoCorpo, CorCartao } from '@/lib/tipos'

export const CORES: { valor: CorCartao; rotulo: string }[] = [
  { valor: 'azul', rotulo: 'Azul' },
  { valor: 'roxo', rotulo: 'Roxo' },
  { valor: 'verde', rotulo: 'Verde' },
  { valor: 'laranja', rotulo: 'Laranja' },
  { valor: 'vermelho', rotulo: 'Vermelho' },
  { valor: 'grafite', rotulo: 'Grafite' },
]

// Fundo de cada cor do cartão (a lista de cores é a mesma do CHECK no banco).
export const FUNDOS: Record<CorCartao, string> = {
  azul: 'from-sky-600 to-blue-900',
  roxo: 'from-violet-500 to-purple-900',
  verde: 'from-emerald-500 to-teal-900',
  laranja: 'from-amber-500 to-orange-700',
  vermelho: 'from-rose-500 to-red-800',
  grafite: 'from-zinc-500 to-zinc-900',
}

const centavosParaTexto = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',')

const inteiroEntre = (texto: string, min: number, max: number) =>
  /^\d+$/.test(texto) && Number(texto) >= min && Number(texto) <= max

const dia = (rotulo: string) =>
  z.string().refine((v) => inteiroEntre(v, 1, 31), `O dia de ${rotulo} vai de 1 a 31.`)

// ---------- Cartão ----------

export const esquemaCartao = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do cartão.').max(40, 'Nome longo demais.'),
  final: z.string().refine((v) => v === '' || /^\d{4}$/.test(v), 'O final do cartão tem 4 dígitos.'),
  cor: z.enum(['azul', 'roxo', 'verde', 'laranja', 'vermelho', 'grafite']),
  diaFechamento: dia('fechamento'),
  diaVencimento: dia('vencimento'),
  limite: z.string().refine((v) => !v.trim() || (paraCentavos(v) ?? 0) > 0, 'Digite o limite, por exemplo 5.000,00.'),
})

export type DadosCartao = z.infer<typeof esquemaCartao>

export const camposDaApiCartao = { limiteCentavos: 'limite' } as const

export const valoresIniciaisCartao = (c?: Cartao): DadosCartao => ({
  nome: c?.nome ?? '',
  final: c?.final ?? '',
  cor: c?.cor ?? 'azul',
  diaFechamento: c ? String(c.diaFechamento) : '',
  diaVencimento: c ? String(c.diaVencimento) : '',
  limite: c?.limiteCentavos ? centavosParaTexto(c.limiteCentavos) : '',
})

export const cartaoParaCorpo = (d: DadosCartao): CartaoCorpo => ({
  nome: d.nome.trim(),
  final: d.final || null,
  cor: d.cor,
  diaFechamento: Number(d.diaFechamento),
  diaVencimento: Number(d.diaVencimento),
  limiteCentavos: d.limite.trim() ? paraCentavos(d.limite) : null,
})

// ---------- Compra ----------

export const esquemaCompra = z.object({
  descricao: z.string().trim().min(1, 'Informe a descrição.').max(200, 'Descrição longa demais.'),
  valor: z.string().refine((v) => (paraCentavos(v) ?? 0) > 0, 'Digite o valor total, por exemplo 250,00.'),
  parcelas: z.string().refine((v) => inteiroEntre(v, 1, 48), 'Use de 1 a 48 parcelas.'),
  dataCompra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data da compra.'),
  categoriaId: z.string(),
  observacoes: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
})

export type DadosCompra = z.infer<typeof esquemaCompra>

export const camposDaApiCompra = { valorTotalCentavos: 'valor' } as const

export const valoresIniciaisCompra = (compra?: CompraCartao, dataPadrao = hojeISO()): DadosCompra => ({
  descricao: compra?.descricao ?? '',
  valor: compra ? centavosParaTexto(compra.valorTotalCentavos) : '',
  parcelas: String(compra?.parcelas ?? 1),
  dataCompra: compra?.dataCompra ?? dataPadrao,
  categoriaId: compra?.categoriaId ?? '',
  observacoes: compra?.observacoes ?? '',
})

export const compraParaCorpo = (d: DadosCompra): CompraCartaoCorpo => ({
  descricao: d.descricao.trim(),
  valorTotalCentavos: paraCentavos(d.valor)!,
  parcelas: Number(d.parcelas),
  dataCompra: d.dataCompra,
  categoriaId: d.categoriaId || null,
  observacoes: d.observacoes.trim() || null,
})
