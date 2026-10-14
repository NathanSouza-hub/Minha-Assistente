// Dias da semana da rotina. Índice = valor da API (0 = domingo).
export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Ordem de exibição: segunda primeiro, como no calendário brasileiro de trabalho. */
export const ORDEM_EXIBICAO = [1, 2, 3, 4, 5, 6, 0]

export const TODOS = [0, 1, 2, 3, 4, 5, 6]
export const UTEIS = [1, 2, 3, 4, 5]
export const FIM_DE_SEMANA = [0, 6]

const iguais = (a: number[], b: number[]) => a.length === b.length && b.every((d) => a.includes(d))

/** "Todos os dias" · "Segunda a sexta" · "Fim de semana" · "Toda terça" · "Segunda, quarta e sexta" */
export function descreverDias(dias: number[]) {
  if (iguais(dias, TODOS)) return 'Todos os dias'
  if (iguais(dias, UTEIS)) return 'Segunda a sexta'
  if (iguais(dias, FIM_DE_SEMANA)) return 'Fim de semana'
  const escolhidos = ORDEM_EXIBICAO.filter((d) => dias.includes(d))
  if (escolhidos.length === 1) {
    const dia = escolhidos[0]
    // "sábado" e "domingo" são masculinos; os outros dias, femininos.
    return `${dia === 0 || dia === 6 ? 'Todo' : 'Toda'} ${DIAS[dia].toLowerCase()}`
  }
  const nomes = escolhidos.map((d, i) => (i === 0 ? DIAS[d] : DIAS[d].toLowerCase()))
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
}
