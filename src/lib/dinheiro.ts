// A API trabalha com dinheiro em centavos inteiros (15990 = R$ 159,90).
// Nunca faça conta com reais em ponto flutuante: converta para centavos o quanto antes.

const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** 15990 → "R$ 159,90" */
export function formatarCentavos(centavos: number): string {
  return formatador.format(centavos / 100)
}

/**
 * Converte o que a pessoa digitou em centavos. Aceita "159,90", "R$ 1.234,5", "1234" e "0,99".
 * Devolve `null` se o texto não for um valor válido.
 */
export function paraCentavos(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/g, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null

  const [inteiro, decimal = ''] = limpo.replace(/\./g, '').split(',')
  // Soma em inteiros para não passar por float (0,29 * 100 = 28.999...).
  return Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'))
}
