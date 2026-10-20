const { DateTime } = require('luxon');
const db = require('../../config/db');
const { FUSO, hoje, paraISO } = require('../../lib/tempo');
const { expandir } = require('../../lib/recorrencia');
const { naoEncontrado } = require('../../lib/erros');
const { TIPOS_SAUDE } = require('./schema');

const DIAS_PADRAO = 30;

const COLUNAS = [
  'id',
  'titulo',
  'tipo',
  'tipoDescricao',
  'modalidade',
  'inicio',
  'fim',
  'local',
  'profissional',
  'especialidade',
  'link',
  'observacoes',
  'recorrencia',
  'recorrenciaFim',
  'lembretesMinutosAntes',
  'criadoEm',
  'atualizadoEm',
];

const instante = (iso) => DateTime.fromISO(iso).setZone(FUSO);

// Linha do banco → evento da API (a série inteira, como foi cadastrada).
const serie = (linha) => ({
  ...linha,
  recorrente: linha.recorrencia !== 'nenhuma',
  inicioSerie: linha.inicio,
});

const camposGravaveis = (d) => ({
  titulo: d.titulo,
  tipo: d.tipo,
  // A descrição só existe no tipo "outro" (trocar de tipo apaga a antiga).
  tipoDescricao: d.tipo === 'outro' ? d.tipoDescricao : null,
  modalidade: d.modalidade,
  inicio: d.inicio,
  fim: d.fim,
  local: d.local,
  // Profissional e especialidade só nos tipos de saúde (trocar de tipo apaga).
  profissional: TIPOS_SAUDE.includes(d.tipo) ? d.profissional : null,
  especialidade: TIPOS_SAUDE.includes(d.tipo) ? d.especialidade : null,
  link: d.link,
  observacoes: d.observacoes,
  recorrencia: d.recorrencia,
  recorrenciaFim: d.recorrencia === 'nenhuma' ? null : d.recorrenciaFim,
  lembretesMinutosAntes: d.lembretesMinutosAntes,
});

// Lembretes ainda não enviados deixam de valer quando o evento muda ou é apagado;
// o agendador gera os novos.
const cancelarLembretesPendentes = (conexao, id) =>
  conexao('lembreteEnvio')
    .where({ origemTipo: 'evento', origemId: id, status: 'pendente' })
    .update({ status: 'cancelado' });

/** Ocorrências do usuário entre os dias `inicio` e `fim` (inclusive), em ordem de início. */
async function listar(usuarioId, filtros = {}) {
  const primeiroDia = filtros.inicio ?? hoje();
  const ultimoDia =
    filtros.fim ?? DateTime.fromISO(primeiroDia).plus({ days: DIAS_PADRAO }).toISODate();
  const de = DateTime.fromISO(primeiroDia, { zone: FUSO }).startOf('day');
  const ate = DateTime.fromISO(ultimoDia, { zone: FUSO }).plus({ days: 1 }).startOf('day');

  // Pré-filtro no banco; a sobreposição exata (e a expansão) é feita em `expandir`.
  const q = db('evento')
    .select(COLUNAS)
    .where({ usuarioId })
    .where('inicio', '<', ate.toISO())
    .where((w) =>
      w
        .where((unico) =>
          unico.where('recorrencia', 'nenhuma').where(db.raw('COALESCE(fim, inicio)'), '>=', de.toISO()),
        )
        .orWhere((rec) =>
          rec
            .whereNot('recorrencia', 'nenhuma')
            .where((f) => f.whereNull('recorrenciaFim').orWhere('recorrenciaFim', '>=', primeiroDia)),
        ),
    );
  if (filtros.tipo) q.where('tipo', filtros.tipo);

  const linhas = await q;
  const ocorrencias = linhas.flatMap((linha) => {
    const inicio = instante(linha.inicio);
    const duracaoMs = linha.fim ? instante(linha.fim).diff(inicio).as('milliseconds') : 0;
    return expandir(
      { inicio, duracaoMs, recorrencia: linha.recorrencia, ate: linha.recorrenciaFim },
      de,
      ate,
    ).map((o) => ({
      ...serie(linha),
      inicio: paraISO(o.inicio),
      fim: linha.fim ? paraISO(o.fim) : null,
    }));
  });

  return ocorrencias.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo));
}

async function buscar(usuarioId, id) {
  const linha = await db('evento').select(COLUNAS).where({ id, usuarioId }).first();
  if (!linha) throw naoEncontrado('Evento');
  return serie(linha);
}

async function criar(usuarioId, dados) {
  const [linha] = await db('evento')
    .insert({ ...camposGravaveis(dados), usuarioId })
    .returning(COLUNAS);
  return serie(linha);
}

async function atualizar(usuarioId, id, dados) {
  return db.transaction(async (trx) => {
    const [linha] = await trx('evento')
      .where({ id, usuarioId })
      .update(camposGravaveis(dados))
      .returning(COLUNAS);
    if (!linha) throw naoEncontrado('Evento');
    await cancelarLembretesPendentes(trx, id);
    return serie(linha);
  });
}

async function remover(usuarioId, id) {
  await db.transaction(async (trx) => {
    const apagados = await trx('evento').where({ id, usuarioId }).del();
    if (!apagados) throw naoEncontrado('Evento');
    await cancelarLembretesPendentes(trx, id);
  });
}

module.exports = { listar, buscar, criar, atualizar, remover };
