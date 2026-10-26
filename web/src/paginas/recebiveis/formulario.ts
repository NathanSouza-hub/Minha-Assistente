// Formulário de recebível ↔ corpo da API. Regras espelhando src/modules/recebiveis/schema.js.
import { z } from 'zod'
import { formatarCentavos, paraCentavos } from '@/lib/dinheiro'
import type { OrigemRecebivel, Recebivel, RecebivelCorpo, StatusRecebivel } from '@/lib/tipos'

export const ORIGENS: Record<OrigemRecebivel, string> = {
  aluguel: 'Aluguel',
  dividendos: 'Dividendos',
  rendimentos: 'Rendimentos',
  honorarios: 'Honorários',
  outros: 'Outros',
}

/** Origem para exibir: "Outros · Juros de empréstimo" quando a pessoa especificou. */
export const nomeDaOrigem = (r: Pick<Recebivel, 'origem' | 'origemDescricao'>) =>
  r.origem === 'outros' && r.origemDescricao ? `${ORIGENS.outros} · ${r.origemDescricao}` : ORIGENS[r.origem]

export const STATUS: Record<StatusRecebivel, string> = {
  pendente: 'A receber',
  parcial: 'Recebido em parte',
  recebido: 'Recebido',
}

const data = /^\d{4}-\d{2}-\d{2}$/
const valor = z.string().refine((v) => (paraCentavos(v) ?? 0) > 0, 'Digite o valor, por exemplo 1.500,00.')

export const esquemaRecebivel = z
  .object({
    descricao: z.string().trim().min(1, 'Informe a descrição.').max(200, 'Descrição longa demais.'),
    origem: z.enum(['dividendos', 'aluguel', 'rendimentos', 'honorarios', 'outros']),
    origemDescricao: z.string().max(100, 'Use no máximo 100 caracteres.'),
    valor,
    dataPrevista: z.string().regex(data, 'Informe a data prevista.'),
    recorrencia: z.enum(['nenhuma', 'mensal', 'anual']),
    observacoes: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.origem === 'outros' && !v.origemDescricao.trim()) {
      ctx.addIssue({ code: 'custom', path: ['origemDescricao'], message: 'Especifique a origem.' })
    }
  })

export type DadosRecebivel = z.infer<typeof esquemaRecebivel>

/** Valor em reais para o campo: 150000 → "1.500,00". */
export const valorDoCampo = (centavos: number) => formatarCentavos(centavos).replace(/^R\$\s*/, '')

export function valoresIniciais(r?: Recebivel, dataPadrao = ''): DadosRecebivel {
  return {
    descricao: r?.descricao ?? '',
    origem: r?.origem ?? 'aluguel',
    origemDescricao: r?.origemDescricao ?? '',
    valor: r ? valorDoCampo(r.valorPrevistoCentavos) : '',
    dataPrevista: r?.dataPrevista ?? dataPadrao,
    recorrencia: r?.recorrencia ?? 'nenhuma',
    observacoes: r?.observacoes ?? '',
  }
}

export const paraCorpo = (d: DadosRecebivel): RecebivelCorpo => ({
  descricao: d.descricao.trim(),
  origem: d.origem,
  origemDescricao: d.origem === 'outros' ? d.origemDescricao.trim() : null,
  valorPrevistoCentavos: paraCentavos(d.valor)!,
  dataPrevista: d.dataPrevista,
  recorrencia: d.recorrencia,
  observacoes: d.observacoes.trim() || null,
})

/** Recebimento: valor, data e se é o último (dá por recebido mesmo com menos). */
export const esquemaRecebimento = z.object({
  valor,
  data: z.string().regex(data, 'Informe a data.'),
  observacoes: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
  encerrar: z.boolean(),
})

export type DadosRecebimento = z.infer<typeof esquemaRecebimento>
