// Tarefas avulsas: uma coisa a fazer num dia (com hora e lembrete opcionais). Aparecem na tela Hoje
// (src/modules/hoje/tarefas.js), onde o ✓ conclui a própria tarefa.
const db = require('../../config/db');
const { naoEncontrado } = require('../../lib/erros');

const consulta = (conexao, usuarioId) =>
  conexao('tarefa as t')
    .where('t.usuarioId', usuarioId)
    .select(
      't.id',
      't.titulo',
      't.detalhes',
      't.data',
      't.hora',
      't.lembrete',
      't.concluidaEm',
      't.criadoEm',
      't.atualizadoEm',
      conexao.raw('(t.concluida_em IS NOT NULL) AS concluida'),
      conexao.raw('(t.concluida_em IS NULL AND t.data < current_date) AS atrasada'),
    )
    .orderByRaw('t.data, t.hora NULLS LAST, t.titulo');

const cancelarLembretesPendentes = (conexao, id) =>
  conexao('lembreteEnvio')
    .where({ origemTipo: 'tarefa', origemId: id, status: 'pendente' })
    .update({ status: 'cancelado' });

/**
 * `concluidaNoDia`: só para a tela Hoje, que mostra as atrasadas concluídas no dia (para o ✓ poder
 * ser desfeito); não é filtro da rota. A sessão do banco está no fuso de São Paulo.
 */
function listar(usuarioId, { inicio, fim, situacao, concluidaNoDia } = {}) {
  const q = consulta(db, usuarioId);
  if (inicio) q.where('t.data', '>=', inicio);
  if (fim) q.where('t.data', '<=', fim);
  if (situacao === 'pendente') q.whereNull('t.concluidaEm');
  if (situacao === 'concluida') q.whereNotNull('t.concluidaEm');
  if (concluidaNoDia) q.whereRaw('t.concluida_em::date = ?', [concluidaNoDia]);
  return q;
}

async function buscar(usuarioId, id, conexao = db) {
  const tarefa = await consulta(conexao, usuarioId).where('t.id', id).first();
  if (!tarefa) throw naoEncontrado('Tarefa', { feminino: true });
  return tarefa;
}

async function criar(usuarioId, dados) {
  const [{ id }] = await db('tarefa').insert({ usuarioId, ...dados }).returning('id');
  return buscar(usuarioId, id);
}

// Mudar data, hora ou lembrete refaz os lembretes: os pendentes saem e o agendador gera de novo.
async function atualizar(usuarioId, id, dados) {
  return db.transaction(async (trx) => {
    const alterados = await trx('tarefa').where({ id, usuarioId }).update(dados);
    if (!alterados) throw naoEncontrado('Tarefa', { feminino: true });
    await cancelarLembretesPendentes(trx, id);
    return buscar(usuarioId, id, trx);
  });
}

async function remover(usuarioId, id) {
  await db.transaction(async (trx) => {
    const apagados = await trx('tarefa').where({ id, usuarioId }).del();
    if (!apagados) throw naoEncontrado('Tarefa', { feminino: true });
    await cancelarLembretesPendentes(trx, id);
    await trx('tarefaRegistro').where({ usuarioId, categoria: 'tarefa', itemId: id }).del();
  });
}

/** Conclui (guarda quando) ou reabre. Concluir de novo mantém o horário da primeira conclusão. */
async function concluir(usuarioId, id, { concluida }) {
  const alterados = await db('tarefa')
    .where({ id, usuarioId })
    .update({ concluidaEm: concluida ? db.raw('COALESCE(concluida_em, now())') : null });
  if (!alterados) throw naoEncontrado('Tarefa', { feminino: true });
  return buscar(usuarioId, id);
}

module.exports = { listar, buscar, criar, atualizar, remover, concluir };
