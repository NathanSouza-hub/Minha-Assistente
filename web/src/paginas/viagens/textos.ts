// Textos das viagens: período, situação (próxima, em viagem, passada) e anexos.
import { deDataISO, diasAte, hojeISO } from '@/lib/datas'

export { formatarTamanho } from '@/lib/arquivos'

/** Mesmo limite do back-end (modules/viagens/service.js). */
export const MAXIMO_ANEXOS = 20

const diaEMes = (data: string) => deDataISO(data).toFormat("d 'de' LLLL")

/**
 * "20 a 27 de dezembro", "20 de dezembro a 5 de janeiro de 2027". O ano só aparece quando não é
 * o ano corrente.
 */
export function descreverPeriodo(ida: string, volta: string | null, hoje = hojeISO()) {
  const inicio = deDataISO(ida)
  const fim = deDataISO(volta ?? ida)
  const anoAtual = deDataISO(hoje).year
  const comAno = (data: string) => {
    const ano = deDataISO(data).year
    return ano === anoAtual ? diaEMes(data) : `${diaEMes(data)} de ${ano}`
  }

  if (!volta || volta === ida) return comAno(ida)
  if (inicio.hasSame(fim, 'month')) return `${inicio.day} a ${comAno(volta)}`
  if (inicio.year === fim.year) return `${diaEMes(ida)} a ${comAno(volta)}`
  return `${comAno(ida)} a ${comAno(volta)}`
}

export type Fase = 'agora' | 'proxima' | 'passada'

/** Em que fase a viagem está e o texto curto para o cartão ("Começa em 5 dias", "Volta amanhã"). */
export function situacaoViagem(
  ida: string,
  volta: string | null,
  hoje = hojeISO(),
): { fase: Fase; texto: string | null } {
  const fim = volta ?? ida
  if (ida > hoje) {
    const dias = diasAte(ida, hoje)
    if (dias === 1) return { fase: 'proxima', texto: 'Começa amanhã' }
    if (dias <= 60) return { fase: 'proxima', texto: `Começa em ${dias} dias` }
    return { fase: 'proxima', texto: `Começa em ${Math.round(dias / 30)} meses` }
  }
  if (fim >= hoje) {
    if (fim === ida) return { fase: 'agora', texto: 'É hoje' }
    if (ida === hoje) return { fase: 'agora', texto: 'Começa hoje' }
    const dias = diasAte(fim, hoje)
    if (dias === 0) return { fase: 'agora', texto: 'Volta hoje' }
    if (dias === 1) return { fase: 'agora', texto: 'Em viagem, volta amanhã' }
    return { fase: 'agora', texto: `Em viagem, volta em ${dias} dias` }
  }
  return { fase: 'passada', texto: null }
}

export const contarAnexos = (n: number) => (n === 1 ? '1 anexo' : `${n} anexos`)
