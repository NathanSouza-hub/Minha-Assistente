// Compromissos do dia a dia, oferecidos prontos enquanto ainda não foram cadastrados.
import { chaveCategoria } from '@/lib/compras'
import type { Rotina } from '@/lib/tipos'

export const SUGESTOES = [
  'Leitura de e-mails',
  'Leitura do WhatsApp',
  'Enviar mensagens',
  'Verificar pagamentos bancários',
]

/** Sugestões que ainda não têm um compromisso com o mesmo nome (sem diferenciar maiúsculas/acentos). */
export function sugestoesFaltando(rotinas: Pick<Rotina, 'titulo'>[]) {
  const existentes = new Set(rotinas.map((r) => chaveCategoria(r.titulo)))
  return SUGESTOES.filter((s) => !existentes.has(chaveCategoria(s)))
}
