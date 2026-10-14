// Formulário de viagem ↔ corpo da API. Regras espelhando src/modules/viagens/schema.js.
import { z } from 'zod'
import type { Viagem, ViagemCorpo } from '@/lib/tipos'

const data = /^\d{4}-\d{2}-\d{2}$/
const texto = (max: number) => z.string().max(max, `Use no máximo ${max} caracteres.`)

export const esquemaViagem = z
  .object({
    destino: z.string().trim().min(1, 'Informe o destino.').max(200, 'Destino longo demais.'),
    ida: z.string().regex(data, 'Informe a data de ida.'),
    volta: z.string().refine((v) => v === '' || data.test(v), 'Data inválida.'),
    hospedagem: texto(500),
    transporte: texto(500),
    observacoes: texto(2000),
  })
  .refine((v) => !v.volta || !v.ida || v.volta >= v.ida, {
    message: 'A volta precisa ser no mesmo dia ou depois da ida.',
    path: ['volta'],
  })

export type DadosViagem = z.infer<typeof esquemaViagem>

export function valoresIniciais(v?: Viagem): DadosViagem {
  return {
    destino: v?.destino ?? '',
    ida: v?.ida ?? '',
    volta: v?.volta ?? '',
    hospedagem: v?.hospedagem ?? '',
    transporte: v?.transporte ?? '',
    observacoes: v?.observacoes ?? '',
  }
}

export const paraCorpo = (d: DadosViagem): ViagemCorpo => ({
  destino: d.destino.trim(),
  ida: d.ida,
  volta: d.volta || null,
  hospedagem: d.hospedagem.trim() || null,
  transporte: d.transporte.trim() || null,
  observacoes: d.observacoes.trim() || null,
})
