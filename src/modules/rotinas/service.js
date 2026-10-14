const { DateTime } = require('luxon');
const db = require('../../config/db');
const { hoje } = require('../../lib/tempo');
const { naoEncontrado, requisicaoInvalida } = require('../../lib/erros');

const COLUNAS = ['id', 'titulo', 'hora', 'diasSemana', 'ativo', 'ordem', 'lembrete', 'criadoEm', 'atualizadoEm'];
const ORDEM = 'ordem, hora NULLS LAST, titulo';

// 0 = domingo ... 6 = sábado (Luxon usa 1 = segunda ... 7 = domingo).
const diaDaSemana = (dataISO) => DateTime.fromISO(dataISO).weekday % 7;

const camposGravaveis = (d) => ({
  titulo: d.titulo,
  hora: d.hora,
  diasSemana: d.diasSemana,
  ativo: d.ativo,
  ordem: d.ordem,
  lembrete: d.lembrete,
});

const cancelarLembretesPendentes = (conexao, id) =>
  conexao('lembreteEnvio')
    .where({ origemTipo: 'rotina', origemId: id, status: 'pendente' })
    .update({ status: 'cancelado' });

const listar = (usuarioId) => db('rotina').select(COLUNAS).where({ usuarioId }).orderByRaw(ORDEM);

async function criar(usuarioId, dados) {
  const [rotina] = await db('rotina')
    .insert({ ...camposGravaveis(dados), usuarioId })
    .returning(COLUNAS);
  return rotina;
}

async function atualizar(usuarioId, id, dados) {
  return db.transaction(async (trx) => {
    const [rotina] = await trx('rotina')
      .where({ id, usuarioId })
      .update(camposGravaveis(dados))
      .returning(COLUNAS);
    if (!rotina) throw naoEncontrado('Rotina');
    await cancelarLembretesPendentes(trx, id);
    return rotina;
  });
}

async function remover(usuarioId, id) {
  await db.transaction(async (trx) => {
    const apagados = await trx('rotina').where({ id, usuarioId }).del();
    if (!apagados) throw naoEncontrado('Rotina');
    await cancelarLembretesPendentes(trx, id);
  });
}

const itens = (usuarioId, data) =>
  db('rotina as t')
    .leftJoin('rotinaConclusao as c', (j) =>
      j.on('c.rotinaId', 't.id').andOn('c.data', db.raw('?::date', [data])),
    )
    .where('t.usuarioId', usuarioId)
    .select('t.id as rotinaId', 't.titulo', 't.hora', 't.ordem', 't.diasSemana', 'c.concluidaEm')
    .orderByRaw('t.ordem, t.hora NULLS LAST, t.titulo');

const formatarItem = (data, linha) => ({
  rotinaId: linha.rotinaId,
  titulo: linha.titulo,
  hora: linha.hora,
  ordem: linha.ordem,
  data,
  concluida: Boolean(linha.concluidaEm),
  concluidaEm: linha.concluidaEm ?? null,
});

/** Tarefas ativas previstas para o dia, com o status de concluída. */
async function doDia(usuarioId, { data = hoje() } = {}) {
  const linhas = await itens(usuarioId, data)
    .where('t.ativo', true)
    .whereRaw('t.dias_semana @> ARRAY[?]::smallint[]', [diaDaSemana(data)]);
  return linhas.map((linha) => formatarItem(data, linha));
}

async function concluir(usuarioId, id, { data = hoje(), concluida }) {
  const linha = await itens(usuarioId, data).where('t.id', id).first();
  if (!linha) throw naoEncontrado('Rotina');
  if (!linha.diasSemana.includes(diaDaSemana(data))) {
    throw requisicaoInvalida('data: esta tarefa não está prevista para esse dia da semana.');
  }

  if (concluida) {
    await db('rotinaConclusao').insert({ rotinaId: id, data }).onConflict(['rotinaId', 'data']).ignore();
  } else {
    await db('rotinaConclusao').where({ rotinaId: id, data }).del();
  }

  return formatarItem(data, await itens(usuarioId, data).where('t.id', id).first());
}

module.exports = { listar, criar, atualizar, remover, doDia, concluir };
