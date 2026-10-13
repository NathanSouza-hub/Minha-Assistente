// Expande séries recorrentes em ocorrências dentro de um intervalo.
// Cada ocorrência é calculada a partir do início da série (não da anterior), então uma série
// mensal do dia 31 cai em 31/jan, 28/fev, 31/mar... O fuso de referência evita surpresas de horário.
const { DateTime } = require('luxon');
const { FUSO } = require('./tempo');

const UNIDADE = { diaria: 'days', semanal: 'weeks', mensal: 'months', anual: 'years' };

// Proteção contra séries muito longas num intervalo grande.
const MAXIMO_OCORRENCIAS = 2000;

/**
 * @param {object} serie
 * @param {DateTime} serie.inicio     início da primeira ocorrência
 * @param {number}  serie.duracaoMs   duração de cada ocorrência (0 se não houver fim)
 * @param {string}  serie.recorrencia 'nenhuma' | 'diaria' | 'semanal' | 'mensal' | 'anual'
 * @param {string|null} serie.ate     último dia (AAAA-MM-DD, inclusive) ou null
 * @param {DateTime} de               início do intervalo (inclusive)
 * @param {DateTime} ate              fim do intervalo (exclusive)
 * @returns {{ inicio: DateTime, fim: DateTime }[]} ocorrências que se sobrepõem ao intervalo
 */
function expandir({ inicio, duracaoMs, recorrencia, ate: ultimoDia }, de, ate) {
  const sobrepoe = (ini, fim) => ini < ate && (duracaoMs ? fim > de : ini >= de);
  const ocorrencia = (ini) => ({ inicio: ini, fim: ini.plus({ milliseconds: duracaoMs }) });

  if (recorrencia === 'nenhuma') {
    const unica = ocorrencia(inicio);
    return sobrepoe(unica.inicio, unica.fim) ? [unica] : [];
  }

  const unidade = UNIDADE[recorrencia];
  const limite = ultimoDia
    ? DateTime.fromISO(ultimoDia, { zone: FUSO }).plus({ days: 1 }).startOf('day')
    : null;

  // Pula direto para perto do início do intervalo, em vez de iterar desde a primeira ocorrência.
  const antesDoIntervalo = de.minus({ milliseconds: duracaoMs }).diff(inicio, unidade).as(unidade);
  let passo = Math.max(0, Math.floor(antesDoIntervalo) - 1);

  const resultado = [];
  while (resultado.length < MAXIMO_OCORRENCIAS) {
    const ini = inicio.plus({ [unidade]: passo });
    if (ini >= ate || (limite && ini >= limite)) break;
    const atual = ocorrencia(ini);
    if (sobrepoe(atual.inicio, atual.fim)) resultado.push(atual);
    passo += 1;
  }
  return resultado;
}

module.exports = { expandir, UNIDADE };
