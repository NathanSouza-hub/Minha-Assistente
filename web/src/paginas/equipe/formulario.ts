// Formulário da pessoa da equipe: textos digitados ↔ corpo da API (src/modules/equipe/schema.js).
import { z } from 'zod'
import { paraCentavos } from '@/lib/dinheiro'
import type { FormaPagamento, MembroEquipe, MembroEquipeCorpo } from '@/lib/tipos'

export const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'mensal', rotulo: 'Por mês' },
  { valor: 'plantao', rotulo: 'Plantão' },
  { valor: 'honorario', rotulo: 'Honorário' },
]

export const centavosParaTexto = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',')

const diaValido = (v: string) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 31

export const esquemaMembro = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.').max(80, 'Nome longo demais.'),
  funcao: z.string().max(60, 'Use no máximo 60 caracteres.'),
  formaPagamento: z.enum(['mensal', 'plantao', 'honorario']),
  chavePix: z.string().max(140, 'Use no máximo 140 caracteres.'),
  ativo: z.boolean(),
  dias: z
    .array(
      z.object({
        dia: z.string().refine(diaValido, 'Dia de 1 a 31.'),
        valor: z.string().refine((v) => !v.trim() || (paraCentavos(v) ?? 0) > 0, 'Valor inválido.'),
      }),
    )
    .min(1, 'Informe pelo menos um dia de pagamento.')
    .refine(
      (dias) => new Set(dias.map((d) => Number(d.dia))).size === dias.length,
      'Há dias de pagamento repetidos.',
    ),
})

export type DadosMembro = z.infer<typeof esquemaMembro>

export const valoresIniciais = (m?: MembroEquipe): DadosMembro => ({
  nome: m?.nome ?? '',
  funcao: m?.funcao ?? '',
  formaPagamento: m?.formaPagamento ?? 'mensal',
  chavePix: m?.chavePix ?? '',
  ativo: m?.ativo ?? true,
  dias: m?.dias.map((d) => ({
    dia: String(d.dia),
    valor: d.valorPrevistoCentavos ? centavosParaTexto(d.valorPrevistoCentavos) : '',
  })) ?? [{ dia: '', valor: '' }],
})

export const paraCorpo = (d: DadosMembro): MembroEquipeCorpo => ({
  nome: d.nome.trim(),
  funcao: d.funcao.trim() || null,
  formaPagamento: d.formaPagamento,
  chavePix: d.chavePix.trim() || null,
  ativo: d.ativo,
  dias: d.dias.map((x) => ({
    dia: Number(x.dia),
    valorPrevistoCentavos: x.valor.trim() ? paraCentavos(x.valor) : null,
  })),
})
