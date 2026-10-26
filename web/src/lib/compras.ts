// Ordem da lista de compras, a do back-end (modules/compras/service.js): pendentes primeiro, por
// categoria (sem categoria no fim) e nome, na ordem do português; depois os comprados, do mais
// recente ao mais antigo. A tela reordena com esta função ao marcar, sem esperar o servidor.
import type { ItemCompra } from './tipos'

const comparar = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })

/** "Farmácia", "farmacia" e "FARMÁCIA" são a mesma categoria. */
export const chaveCategoria = (categoria: string) =>
  categoria.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()

/**
 * Itens por categoria, na ordem em que chegam (sem categoria no fim). Agrupa sem diferenciar
 * maiúsculas e acentos; o título é o primeiro jeito como a categoria foi escrita.
 */
export function agruparPorCategoria<T extends Pick<ItemCompra, 'categoria'>>(itens: T[]) {
  const grupos = new Map<string, { chave: string; titulo: string; itens: T[] }>()
  for (const item of itens) {
    const chave = item.categoria === null ? '' : chaveCategoria(item.categoria)
    const grupo = grupos.get(chave) ?? { chave, titulo: item.categoria ?? 'Sem categoria', itens: [] }
    grupo.itens.push(item)
    grupos.set(chave, grupo)
  }
  return [...grupos.values()].sort((a, b) => (a.chave === '' ? 1 : 0) - (b.chave === '' ? 1 : 0))
}

export function ordenarCompras<T extends Pick<ItemCompra, 'nome' | 'categoria' | 'comprado' | 'compradoEm'>>(
  itens: T[],
): T[] {
  return [...itens].sort(
    (a, b) =>
      Number(a.comprado) - Number(b.comprado) ||
      (b.compradoEm ?? '').localeCompare(a.compradoEm ?? '') ||
      (a.categoria === null ? 1 : 0) - (b.categoria === null ? 1 : 0) ||
      comparar(a.categoria ?? '', b.categoria ?? '') ||
      comparar(a.nome, b.nome),
  )
}
