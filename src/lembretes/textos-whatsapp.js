// Variáveis do modelo "lembrete" do WhatsApp (decisão 38): {{1}} = o que fazer (o compromisso
// primeiro), {{2}} = quando e detalhes. Lembretes do mesmo tipo no mesmo horário viram uma mensagem
// só, com todos listados pelo nome (nunca "3 contas" sem dizer quais).
// Cada gerador devolve, em `mensagem().whatsapp`, um item com `tipo` e os dados crus:
// - medicamento_horario: { nome, dose, hora }
// - pagamento: { nome, centavos, vencimento, hoje }
// - evento: { titulo, quando, local }; rotina e tarefa: { titulo, quando }
const { naData, formatarCentavos, juntar } = require('./textos');

// Limites que o canal aplica às variáveis (src/lembretes/canais/whatsapp.js).
const MAXIMO_ACAO = 200;
const MAXIMO_DETALHE = 600;

const umaLinha = (texto) => (texto ?? '').replace(/\s+/g, ' ').trim();
const semPontoFinal = (texto) => umaLinha(texto).replace(/[\s.,;:]+$/, '');
const comPontoFinal = (texto) => (/[.!?…]$/.test(texto) ? texto : `${texto}.`);
const diaMes = (data) => naData(data, '00:00').toFormat('dd/MM');

/** ["A"] → "A"; ["A", "B", "C"] → "A, B e C". */
function emLista(nomes) {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

/**
 * O maior começo da lista que cabe em `maximo` (o resto vira "mais N"); se nem um item cabe,
 * corta o texto com reticências.
 * @param {(partes: string[], resto: number) => string} montar
 */
function caber(partes, montar, maximo) {
  for (let k = partes.length; k >= 1; k--) {
    const texto = montar(partes.slice(0, k), partes.length - k);
    if (texto.length <= maximo) return texto;
  }
  return `${montar(partes.slice(0, 1), partes.length - 1).slice(0, maximo - 1).trimEnd()}…`;
}

/** "Pagar A, B e mais 2." */
const acaoEmLista = (prefixo, nomes) =>
  caber(nomes, (lista, resto) => comPontoFinal(`${prefixo}${emLista(resto ? [...lista, `mais ${resto}`] : lista)}`), MAXIMO_ACAO);

/** "A · B · e mais 2 · sufixo" */
const detalheEmLista = (partes, sufixo, separador = ' · ') =>
  caber(
    partes,
    (lista, resto) => [...lista, resto && `e mais ${resto}`, sufixo].filter(Boolean).join(separador),
    MAXIMO_DETALHE,
  );

// Dose cadastrada só com número ("2") não diz o que tomar: vira "Dose: 2".
const soNumero = (dose) => /^\d+([.,]\d+)?$/.test(dose);

function remedios(itens) {
  const doses = itens.map((i) => ({ nome: semPontoFinal(i.nome), dose: semPontoFinal(i.dose) }));
  const detalhe = `Agora, às ${itens[0].hora}`;
  if (doses.length === 1) {
    const [{ nome, dose }] = doses;
    if (!dose) return [comPontoFinal(`Tomar ${nome}`), detalhe];
    if (soNumero(dose)) return [`Tomar ${nome}. Dose: ${dose}.`, detalhe];
    return [comPontoFinal(`Tomar ${nome}, ${dose}`), detalhe];
  }
  const nomes = doses.map(({ nome, dose }) => {
    if (!dose) return nome;
    return `${nome} (${soNumero(dose) ? `Dose: ${dose}` : dose})`;
  });
  return [acaoEmLista('Tomar ', nomes), detalhe];
}

const valor = (centavos) => (centavos === null || centavos === undefined ? 'valor a definir' : formatarCentavos(centavos));
const vence = (item, plural = false) =>
  `${plural ? 'Vencem' : 'Vence'} ${item.hoje ? 'hoje' : 'amanhã'} (${diaMes(item.vencimento)})`;

function contas(itens) {
  const nomes = itens.map((i) => semPontoFinal(i.nome));
  if (itens.length === 1) return [`Pagar ${nomes[0]}: ${valor(itens[0].centavos)}.`, vence(itens[0])];

  const mesmoDia = itens.every((i) => i.vencimento === itens[0].vencimento && i.hoje === itens[0].hoje);
  const partes = itens.map((i, n) => {
    const texto = `${nomes[n]} ${valor(i.centavos)}`;
    return mesmoDia ? texto : `${texto} (${vence(i).toLowerCase()})`;
  });
  return [acaoEmLista('Pagar ', nomes), detalheEmLista(partes, mesmoDia && vence(itens[0], true))];
}

// Agenda, rotina e tarefa: o título é o próprio compromisso.
function compromissos(itens) {
  const titulos = itens.map((i) => semPontoFinal(i.titulo));
  if (itens.length === 1) return [comPontoFinal(titulos[0]), juntar(itens[0].quando, umaLinha(itens[0].local))];

  const acao = acaoEmLista('', titulos);
  if (itens.every((i) => i.quando === itens[0].quando)) {
    const locais = [...new Set(itens.map((i) => umaLinha(i.local)).filter(Boolean))];
    return [acao, detalheEmLista([itens[0].quando, ...locais], null)];
  }
  // Mesmo horário de aviso, horários diferentes (ex.: antecedências diferentes na agenda).
  const partes = itens.map((i, n) => `${titulos[n]}: ${juntar(i.quando, umaLinha(i.local))}`);
  return [acao, detalheEmLista(partes, null, '; ')];
}

const FORMATOS = {
  medicamento_horario: remedios,
  pagamento: contas,
  evento: compromissos,
  rotina: compromissos,
  tarefa: compromissos,
};

/**
 * [{{1}}, {{2}}] para itens do mesmo tipo, ou null se o tipo não tem formato próprio (o canal usa
 * então o título e o corpo da notificação, como no resumo da manhã).
 */
function variaveis(itens) {
  const formato = itens.length && FORMATOS[itens[0].tipo];
  if (!formato || itens.some((i) => i.tipo !== itens[0].tipo)) return null;
  return formato(itens);
}

module.exports = { variaveis, MAXIMO_ACAO, MAXIMO_DETALHE };
