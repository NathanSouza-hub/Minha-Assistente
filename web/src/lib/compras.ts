// Ordem da lista de compras, a do back-end (modules/compras/service.js): pendentes primeiro, por
// categoria (sem categoria no fim) e nome; depois os comprados, do mais recente ao mais antigo.
// Diferença: o Postgres compara texto byte a byte ("Mercado" antes de "farmácia", "Arroz" antes
// de "Açúcar"); aqui a comparação é a do português, sem diferenciar maiúsculas nem acentos. A tela
// sempre reordena com esta função, então não pula ao recarregar.
import type { ItemCompra } from './tipos'

const comparar = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })

/** "Farmácia", "farmacia" e "FARMÁCIA" são a mesma categoria. */
export const chaveCategoria = (categoria: string) =>
  categoria.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()

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
