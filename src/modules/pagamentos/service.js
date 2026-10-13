const { randomUUID } = require('node:crypto');
const { DateTime } = require('luxon');
const db = require('../../config/db');
const { hoje } = require('../../lib/tempo');
const { AppError, naoEncontrado, requisicaoInvalida } = require('../../lib/erros');

const COLUNAS = [
  'p.id',
  'p.descricao',
  'p.categoriaId',
  'c.nome as categoriaNome',
  'p.imovelId',
  'i.nome as imovelNome',
  'p.valorCentavos',
  'p.vencimento',
  'p.status',
  'p.dataPagamento',
  'p.recorrencia',
  'p.recorrenciaOrigemId',
  'p.parcelamentoGrupoId',
  'p.parcelaAtual',
  'p.parcelaTotal',
  'p.observacoes',
  'p.criadoEm',
  'p.atualizadoEm',
];

// current_date usa o fuso da sessão (America/Sao_Paulo).
const VENCIDO = "(p.status = 'pendente' AND p.vencimento < current_date) AS vencido";

const consulta = (conexao, usuarioId) =>
  conexao('pagamento as p')
    .join('categoriaPagamento as c', 'c.id', 'p.categoriaId')
    .leftJoin('imovel as i', 'i.id', 'p.imovelId')
    .where('p.usuarioId', usuarioId)
    .select(COLUNAS)
    .select(conexao.raw(VENCIDO));

const ORDEM = [{ column: 'p.vencimento' }, { column: 'p.parcelaAtual' }, { column: 'p.criadoEm' }];

const somar = (dataISO, quantidade, unidade) =>
  DateTime.fromISO(dataISO).plus({ [unidade]: quantidade }).toISODate();

async function buscar(usuarioId, id, conexao = db) {
  const pagamento = await consulta(conexao, usuarioId).where('p.id', id).first();
  if (!pagamento) throw naoEncontrado('Pagamento');
  return pagamento;
}

function listar(usuarioId, { inicio, fim, status, categoriaId, imovelId }) {
  const q = consulta(db, usuarioId).orderBy(ORDEM);
  if (inicio) q.where('p.vencimento', '>=', inicio);
  if (fim) q.where('p.vencimento', '<=', fim);
  if (status) q.where('p.status', status);
  if (categoriaId) q.where('p.categoriaId', categoriaId);
  if (imovelId) q.where('p.imovelId', imovelId);
  return q;
}

async function validarReferencias(trx, usuarioId, { categoriaId, imovelId }) {
  const categoria = await trx('categoriaPagamento').where({ id: categoriaId }).first('id');
  if (!categoria) throw requisicaoInvalida('categoriaId: categoria não encontrada.');
  if (imovelId) {
    const imovel = await trx('imovel').where({ id: imovelId, usuarioId }).first('id');
    if (!imovel) throw requisicaoInvalida('imovelId: imóvel não encontrado.');
  }
}

const camposGravaveis = (d) => ({
  descricao: d.descricao,
  categoriaId: d.categoriaId,
  imovelId: d.imovelId,
  valorCentavos: d.valorCentavos,
  vencimento: d.vencimento,
  status: d.status,
  dataPagamento: d.dataPagamento,
  recorrencia: d.recorrencia,
  observacoes: d.observacoes,
});

// Garante a próxima ocorrência de um pagamento recorrente já pago. O vencimento é calculado a
// partir do início da série (não da ocorrência anterior) para não perder o dia: uma conta do
// dia 31 vence 31/jan, 28/fev, 31/mar...
async function garantirProxima(trx, usuarioId, id) {
  const atual = await trx('pagamento').where({ id, usuarioId }).first();
  if (atual.recorrencia === 'nenhuma' || atual.status !== 'pago') return;
  if (await trx('pagamento').where({ recorrenciaOrigemId: id }).first('id')) return;

  const { rows } = await trx.raw(
    `WITH RECURSIVE serie AS (
       SELECT id, recorrencia_origem_id, vencimento, 0 AS passo FROM pagamento WHERE id = ?
       UNION ALL
       SELECT p.id, p.recorrencia_origem_id, p.vencimento, s.passo + 1
       FROM pagamento p JOIN serie s ON p.id = s.recorrencia_origem_id
     )
     SELECT vencimento, passo FROM serie ORDER BY passo DESC LIMIT 1`,
    [id],
  );
  const { vencimento: inicioDaSerie, passo } = rows[0];
  const unidade = atual.recorrencia === 'mensal' ? 'months' : 'years';

  await trx('pagamento').insert({
    usuarioId,
    descricao: atual.descricao,
    categoriaId: atual.categoriaId,
    imovelId: atual.imovelId,
    valorCentavos: atual.valorCentavos,
    vencimento: somar(inicioDaSerie, passo + 1, unidade),
    recorrencia: atual.recorrencia,
    recorrenciaOrigemId: id,
    observacoes: atual.observacoes,
  });
}

// Sem parcelamento devolve o pagamento; com parcelamento devolve o array de parcelas.
async function criar(usuarioId, dados) {
  return db.transaction(async (trx) => {
    await validarReferencias(trx, usuarioId, dados);

    if (dados.parcelamento) {
      const grupo = randomUUID();
      const total = dados.parcelamento.totalParcelas;
      const linhas = Array.from({ length: total }, (_, i) => ({
        ...camposGravaveis(dados),
        usuarioId,
        vencimento: somar(dados.vencimento, i, 'months'),
        parcelamentoGrupoId: grupo,
        parcelaAtual: i + 1,
        parcelaTotal: total,
      }));
      await trx('pagamento').insert(linhas);
      return consulta(trx, usuarioId).where('p.parcelamentoGrupoId', grupo).orderBy(ORDEM);
    }

    const [{ id }] = await trx('pagamento')
      .insert({ ...camposGravaveis(dados), usuarioId })
      .returning('id');
    await garantirProxima(trx, usuarioId, id);
    return buscar(usuarioId, id, trx);
  });
}

async function atualizar(usuarioId, id, dados) {
  return db.transaction(async (trx) => {
    const atual = await buscar(usuarioId, id, trx);
    await validarReferencias(trx, usuarioId, dados);
    if (atual.parcelamentoGrupoId && dados.recorrencia !== 'nenhuma') {
      throw requisicaoInvalida('recorrencia: parcela não pode ser recorrente.');
    }
    await trx('pagamento').where({ id, usuarioId }).update(camposGravaveis(dados));
    await garantirProxima(trx, usuarioId, id);
    return buscar(usuarioId, id, trx);
  });
}

async function pagar(usuarioId, id, { dataPagamento }) {
  return db.transaction(async (trx) => {
    // Só atualiza se ainda estiver pendente: dois cliques simultâneos não pagam duas vezes.
    const alterados = await trx('pagamento')
      .where({ id, usuarioId, status: 'pendente' })
      .update({ status: 'pago', dataPagamento: dataPagamento ?? hoje() });
    if (!alterados) {
      await buscar(usuarioId, id, trx); // 404 se não existir
      throw new AppError(409, 'JA_PAGO', 'Este pagamento já está pago.');
    }
    await garantirProxima(trx, usuarioId, id);
    return buscar(usuarioId, id, trx);
  });
}

async function remover(usuarioId, id) {
  const apagados = await db('pagamento').where({ id, usuarioId }).del();
  if (!apagados) throw naoEncontrado('Pagamento');
}

module.exports = { listar, buscar, criar, atualizar, pagar, remover };
