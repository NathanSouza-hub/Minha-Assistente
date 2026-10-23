import { DateTime } from 'luxon'
import { FUSO } from '@/lib/datas'

/** Mês curto para os eixos: "out", "nov/26" quando muda o ano. */
export function mesCurto(mes: string, comAno = false) {
  const dt = DateTime.fromISO(`${mes}-01`, { zone: FUSO }).setLocale('pt-BR')
  const nome = dt.toFormat('LLL').replace('.', '')
  return comAno ? `${nome}/${dt.toFormat('yy')}` : nome
}

/** R$ compacto para eixos: "R$ 12 mil", "R$ 1,2 mi". */
export function reaisCompacto(centavos: number) {
  const reais = centavos / 100
  const abs = Math.abs(reais)
  const sinal = reais < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `${sinal}R$ ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
