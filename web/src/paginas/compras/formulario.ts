// Item de compra no formulário ↔ corpo da API. Regras espelhando src/modules/compras/schema.js.
import { z } from 'zod'
import { chaveCategoria } from '@/lib/compras'
import { deDataHoraISO, diasAte, horaDe } from '@/lib/datas'
import type { ItemCompra, ItemCompraCorpo } from '@/lib/tipos'

export const esquemaItem = z.object({
  nome: z.string().trim().min(1, 'Informe o item.').max(120, 'Nome longo demais.'),
  quantidade: z.string().max(60, 'Use no máximo 60 caracteres.'),
  categoria: z.string().max(60, 'Use no máximo 60 caracteres.'),
})

export type DadosItem = z.infer<typeof esquemaItem>

export const valoresIniciais = (i?: ItemCompra, categoria = ''): DadosItem => ({
  nome: i?.nome ?? '',
  quantidade: i?.quantidade ?? '',
  categoria: i ? (i.categoria ?? '') : categoria,
})

export const paraCorpo = (d: DadosItem): ItemCompraCorpo => ({
  nome: d.nome.trim(),
  quantidade: d.quantidade.trim() || null,
  categoria: d.categoria.trim() || null,
})

const CATEGORIAS_COMUNS = ['Mercado', 'Feira', 'Farmácia', 'Padaria', 'Açougue', 'Casa']

/** Categorias já usadas + as comuns, sem repetir (ignorando maiúsculas e acentos). */
export function sugerirCategorias(itens: ItemCompra[]) {
  const vistas = new Map<string, string>()
  for (const c of [...itens.map((i) => i.categoria), ...CATEGORIAS_COMUNS]) {
    if (c && !vistas.has(chaveCategoria(c))) vistas.set(chaveCategoria(c), c)
  }
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** "Comprado às 10:12", "Comprado ontem", "Comprado em 10/10". */
export function descreverCompra(compradoEm: string) {
  const dias = -diasAte(deDataHoraISO(compradoEm).toISODate()!)
  if (dias <= 0) return `Comprado às ${horaDe(compradoEm)}`
  if (dias === 1) return 'Comprado ontem'
  return `Comprado em ${deDataHoraISO(compradoEm).toFormat('dd/MM')}`
}
