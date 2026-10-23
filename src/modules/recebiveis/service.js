const { DateTime } = require('luxon');
const db = require('../../config/db');
const { hoje } = require('../../lib/tempo');
const { AppError, naoEncontrado } = require('../../lib/erros');
const comprovantes = require('./comprovantes');

// Situação derivada do histórico: nada se guarda em dobro. Recebido = soma dos recebimentos chegou
// ao previsto, ou a pessoa encerrou com menos. Saldo = o que falta (0 quando recebido).
const RECEBIDO = '(SELECT COALESCE(SUM(m.valor_centavos), 0) FROM recebimento m WHERE m.recebivel_id = r.id)';
const STATUS = `CASE WHEN b.encerrado OR b.recebido_centavos >= b.valor_previsto_centavos THEN 'recebido'
  WHEN b.recebido_centavos > 0 THEN 'parcial' ELSE 'pendente' END AS status`;

function consulta(conexao, usuarioId) {
  const base = conexao('recebivel as r')
    .where('r.usuarioId', usuarioId)
    .select(
      'r.id',
      'r.descricao',
      'r.origem',
      'r.origemDescricao',
      'r.valorPrevistoCentavos',
      'r.dataPrevista',
      'r.encerrado',
      'r.recorrencia',
      'r.recorrenciaOrigemId',
      'r.observacoes',
      'r.criadoEm',
      'r.atualizadoEm',
      conexao.raw(`${RECEBIDO} AS recebido_centavos`),
      conexao.raw('(SELECT MAX(m.data) FROM recebimento m WHERE m.recebivel_id = r.id) AS ultimo_recebimento'),
      conexao.raw(
        '(SELECT COUNT(*)::int FROM recebivel_comprovante c WHERE c.recebivel_id = r.id) AS total_comprovantes',
      ),
    );
  const comStatus = conexao.from(base.as('b')).select('b.*', conexao.raw(STATUS));
  return conexao
    .from(comStatus.as('s'))
    .select(
      's.*',
      conexao.raw(
        "CASE WHEN s.status = 'recebido' THEN 0 ELSE s.valor_previsto_centavos - s.recebido_centavos END AS saldo_centavos",
      ),
      conexao.raw("(s.status <> 'recebido' AND s.data_prevista < current_date) AS atrasado"),
    );
}

async function listar(usuarioId, { inicio, fim, status, origem }) {
  const q = consulta(db, usuarioId).orderBy(['s.dataPrevista', 's.descricao']);
  if (inicio) q.where('s.dataPrevista', '>=', inicio);
  if (fim) q.where('s.dataPrevista', '<=', fim);
  if (status) q.where('s.status', status);
  if (origem) q.where('s.origem', origem);
  return q;
}

async function buscar(usuarioId, id, conexao = db) {
  const recebivel = await consulta(conexao, usuarioId).where('s.id', id).first();
  if (!recebivel) throw naoEncontrado('Recebível');
  return recebivel;
}

/** O recebível com o histórico de recebimentos e os comprovantes. */
async function detalhe(usuarioId, id, conexao = db) {
  const recebivel = await buscar(usuarioId, id, conexao);
  const recebimentos = await conexao('recebimento')
    .where({ recebivelId: id })
    .orderBy(['data', 'criadoEm'])
    .select('id', 'valorCentavos', 'data', 'observacoes', 'criadoEm');
  return { ...recebivel, recebimentos, comprovantes: await comprovantes.listar(conexao, id) };
}

const somar = (dataISO, quantidade, unidade) => DateTime.fromISO(dataISO).plus({ [unidade]: quantidade }).toISODate();

// Recorrente recebido ganha a próxima ocorrência (uma só: índice único). A data sai do início da
// série, como nas contas, para o dia 31 não virar 28 para sempre.
async function garantirProxima(trx, usuarioId, id) {
  const atual = await buscar(usuarioId, id, trx);
  if (atual.recorrencia === 'nenhuma' || atual.status !== 'recebido') return;
  if (await trx('recebivel').where({ recorrenciaOrigemId: id }).first('id')) return;

  const { rows } = await trx.raw(
    `WITH RECURSIVE serie AS (
       SELECT id, recorrencia_origem_id, data_prevista, 0 AS passo FROM recebivel WHERE id = ?
       UNION ALL
       SELECT r.id, r.recorrencia_origem_id, r.data_prevista, s.passo + 1
       FROM recebivel r JOIN serie s ON r.id = s.recorrencia_origem_id
     )
     SELECT data_prevista, passo FROM serie ORDER BY passo DESC LIMIT 1`,
    [id],
  );
  const { dataPrevista: inicioDaSerie, passo } = rows[0];

  await trx('recebivel').insert({
    usuarioId,
    descricao: atual.descricao,
    origem: atual.origem,
    origemDescricao: atual.origemDescricao,
    valorPrevistoCentavos: atual.valorPrevistoCentavos,
    dataPrevista: somar(inicioDaSerie, passo + 1, atual.recorrencia === 'mensal' ? 'months' : 'years'),
    recorrencia: atual.recorrencia,
    recorrenciaOrigemId: id,
    observacoes: atual.observacoes,
  });
}

// A descrição da origem só existe em "outros" (trocar de origem apaga a antiga).
const camposGravaveis = (d) => ({ ...d, origemDescricao: d.origem === 'outros' ? d.origemDescricao : null });

async function criar(usuarioId, dados) {
  const [{ id }] = await db('recebivel')
    .insert({ usuarioId, ...camposGravaveis(dados) })
    .returning('id');
  return buscar(usuarioId, id);
}

// Muda só esta ocorrência; as próximas da série nascem dela, então já seguem o novo valor.
async function atualizar(usuarioId, id, dados) {
  return db.transaction(async (trx) => {
    const alterados = await trx('recebivel').where({ id, usuarioId }).update(camposGravaveis(dados));
    if (!alterados) throw naoEncontrado('Recebível');
    await garantirProxima(trx, usuarioId, id);
    return buscar(usuarioId, id, trx);
  });
}

async function remover(usuarioId, id) {
  await db.transaction(async (trx) => {
    if (!(await trx('recebivel').where({ id, usuarioId }).first('id'))) throw naoEncontrado('Recebível');
    await comprovantes.aoApagar(trx, [id]);
    await trx('recebivel').where({ id }).del();
  });
}

/** Registra um recebimento (parcial ou total). Já recebido → 409 JA_RECEBIDO. */
async function receber(usuarioId, id, { valorCentavos, data, observacoes, encerrar }) {
  return db.transaction(async (trx) => {
    // Trava o recebível: dois recebimentos ao mesmo tempo não passam do "já recebido".
    if (!(await trx('recebivel').where({ id, usuarioId }).forUpdate().first('id'))) throw naoEncontrado('Recebível');
    const atual = await buscar(usuarioId, id, trx);
    if (atual.status === 'recebido') throw new AppError(409, 'JA_RECEBIDO', 'Este valor já foi recebido.');

    await trx('recebimento').insert({ recebivelId: id, valorCentavos, data: data ?? hoje(), observacoes });
    if (encerrar) await trx('recebivel').where({ id }).update({ encerrado: true });
    await garantirProxima(trx, usuarioId, id);
    return detalhe(usuarioId, id, trx);
  });
}

/** Desfaz um recebimento do histórico; o recebível volta a aberto (a próxima da série, se criada, fica). */
async function removerRecebimento(usuarioId, id, recebimentoId) {
  return db.transaction(async (trx) => {
    if (!(await trx('recebivel').where({ id, usuarioId }).forUpdate().first('id'))) throw naoEncontrado('Recebível');
    const apagados = await trx('recebimento').where({ id: recebimentoId, recebivelId: id }).del();
    if (!apagados) throw naoEncontrado('Recebimento');
    await trx('recebivel').where({ id }).update({ encerrado: false });
    return detalhe(usuarioId, id, trx);
  });
}

module.exports = { listar, buscar, detalhe, criar, atualizar, remover, receber, removerRecebimento };
