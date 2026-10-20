// Formulários com algo digitado e ainda não salvo, para avisar antes de recarregar o app
// (components/AvisoAtualizacao.tsx). Não depende de cada tela: basta ter mexido num campo dentro
// de um <form> que ainda está na tela. Na dúvida (ex.: o formulário já foi salvo mas continua
// aberto), conta como alterado — o pior caso é perguntar sem precisar.

const alterados = new Set<HTMLFormElement>()

// Campos do Radix (opções, interruptores, caixas) são botões: mudam com clique, sem evento "input".
const CONTROLES_POR_CLIQUE = '[role="radio"], [role="switch"], [role="checkbox"], [role="option"]'

function marcar(evento: Event) {
  const alvo = evento.target
  if (!(alvo instanceof Element)) return
  if (evento.type === 'click' && !alvo.closest(CONTROLES_POR_CLIQUE)) return
  const formulario = alvo.closest('form')
  if (formulario) alterados.add(formulario)
}

/** Passa a acompanhar os formulários da página. Devolve a limpeza. */
export function acompanharFormularios() {
  const eventos = ['input', 'change', 'click'] as const
  for (const tipo of eventos) document.addEventListener(tipo, marcar, true)
  return () => {
    for (const tipo of eventos) document.removeEventListener(tipo, marcar, true)
    alterados.clear()
  }
}

/** Há um formulário na tela com campo alterado desde que foi aberto. */
export function temDadosNaoSalvos() {
  for (const formulario of alterados) if (!formulario.isConnected) alterados.delete(formulario)
  return alterados.size > 0
}
