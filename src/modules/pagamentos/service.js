const { randomUUID } = require('node:crypto');
const { DateTime } = require('luxon');
const db = require('../../config/db');
const { hoje } = require('../../lib/tempo');
const { AppError, naoEncontrado, requisicaoInvalida } = require('../../lib/erros');
const comprovantes = require('./comprovantes');
const { garantirContas, dispensar } = require('../equipe/contas');

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
  'p.cartaoId',
  'k.nome as cartaoNome',
  'p.competencia',
  'p.membroId',
  'e.nome as membroNome',
  'p.criadoEm',
  'p.atualizadoEm',
];

// current_date usa o fuso da sessão (America/Sao_Paulo).
const VENCIDO = "(p.status = 'pendente' AND p.vencimento < current_date) AS vencido";
// A lista mostra um clipe nas contas com comprovante; a lista dos arquivos vem em GET /:id.
const TOTAL_COMPROVANTES =
  '(SELECT count(*) FROM pagamento_comprovante pc WHERE pc.pagamento_id = p.id)::int AS total_comprovantes';

// Fatura de cartão e conta da equipe não têm categoria: os joins são left.
const consulta = (conexao, usuarioId) =>
  conexao('pagamento as p')
    .leftJoin('categoriaPagamento as c', 'c.id', 'p.categoriaId')
    .leftJoin('cartao as k', 'k.id', 'p.cartaoId')
    .leftJoin('membroEquipe as e', 'e.id', 'p.membroId')
    .leftJoin('imovel as i', 'i.id', 'p.imovelId')
    .where('p.usuarioId', usuarioId)
    .select(COLUNAS)
    .select(conexao.raw(VENCIDO))
    .select(conexao.raw(TOTAL_COMPROVANTES));

const ORDEM = [{ column: 'p.vencimento' }, { column: 'p.parcelaAtual' }, { column: 'p.criadoEm' }];

const somar = (dataISO, quantidade, unidade) =>
  DateTime.fromISO(dataISO).plus({ [unidade]: quantidade }).toISODate();

async function buscar(usuarioId, id, conexao = db) {
  const pagamento = await consulta(conexao, usuarioId).where('p.id', id).first();
  if (!pagamento) throw naoEncontrado('Pagamento');
  return pagamento;
}

// Antes de listar, garante as contas da equipe do mês atual e do seguinte.
// `dataPagamento` não é filtro da rota: a tela Hoje usa para achar as vencidas pagas no dia.
async function listar(usuarioId, { inicio, fim, status, categoriaId, imovelId, destino, dataPagamento }) {
  await garantirContas(db, usuarioId);
  const q = consulta(db, usuarioId).orderBy(ORDEM);
  if (inicio) q.where('p.vencimento', '>=', inicio);
  if (fim) q.where('p.vencimento', '<=', fim);
  if (status) q.where('p.status', status);
  if (dataPagamento) q.where('p.dataPagamento', dataPagamento);
  if (categoriaId) q.where('p.categoriaId', categoriaId);
  if (imovelId) q.where('p.imovelId', imovelId);
  if (destino === 'pessoal') q.whereNull('p.imovelId');
  if (destino === 'imovel') q.whereNotNull('p.imovelId');
  return q;
}

async function validarReferencias(trx, usuarioId, { categoriaId, imovelId }) {
  const categoria = await trx('categoriaPagamento').where({ id: categoriaId, usuarioId }).first('id');
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

// Lembretes ainda não enviados deixam de valer quando o pagamento muda, é pago ou apagado;
// o agendador gera os novos (se ainda couberem).
const cancelarLembretesPendentes = (conexao, id) =>
  conexao('lembreteEnvio')
    .where({ origemTipo: 'pagamento', origemId: id, status: 'pendente' })
    .update({ status: 'cancelado' });

// A conta da fatura é mantida pelo módulo de cartões: aqui ela só pode ser paga.
const faturaAutomatica = () =>
  new AppError(409, 'FATURA_AUTOMATICA', 'O valor da fatura vem das compras do cartão.');

// Conta da equipe: só valor (pode ficar a definir), data, situação e observações. A descrição é o
// nome da pessoa. Mudar a data dispensa a original, para o dia não ser criado de novo.
async function atualizarDaEquipe(trx, usuarioId, atual, dados) {
  if (dados.status === 'pago' && dados.valorCentavos === null) {
    throw requisicaoInvalida('valorCentavos: Informe o valor pago.');
  }
  if (dados.vencimento !== atual.vencimento) await dispensar(trx, atual.membroId, atual.vencimento);
  await trx('pagamento').where({ id: atual.id, usuarioId }).update({
    valorCentavos: dados.valorCentavos,
    vencimento: dados.vencimento,
    status: dados.status,
    dataPagamento: dados.dataPagamento,
    observacoes: dados.observacoes,
  });
  await cancelarLembretesPendentes(trx, atual.id);
  return buscar(usuarioId, atual.id, trx);
}

async function atualizar(usuarioId, id, dados) {
  return db.transaction(async (trx) => {
    const atual = await buscar(usuarioId, id, trx);
    if (atual.cartaoId) throw faturaAutomatica();
    if (atual.membroId) return atualizarDaEquipe(trx, usuarioId, atual, dados);
    if (!dados.categoriaId) throw requisicaoInvalida('categoriaId: Escolha a categoria.');
    if (dados.valorCentavos === null) throw requisicaoInvalida('valorCentavos: Informe o valor.');
    await validarReferencias(trx, usuarioId, dados);
    if (atual.parcelamentoGrupoId && dados.recorrencia !== 'nenhuma') {
      throw requisicaoInvalida('recorrencia: parcela não pode ser recorrente.');
    }
    await trx('pagamento').where({ id, usuarioId }).update(camposGravaveis(dados));
    await cancelarLembretesPendentes(trx, id);
    await garantirProxima(trx, usuarioId, id);
    return buscar(usuarioId, id, trx);
  });
}

const jaPago = () => new AppError(409, 'JA_PAGO', 'Este pagamento já está pago.');

// Conta da equipe pode receber o valor na hora de pagar (obrigatório se estava a definir).
async function pagar(usuarioId, id, { dataPagamento, valorCentavos }) {
  return db.transaction(async (trx) => {
    const atual = await buscar(usuarioId, id, trx);
    if (atual.status === 'pago') throw jaPago();
    const valor = atual.membroId ? (valorCentavos ?? atual.valorCentavos) : atual.valorCentavos;
    if (valor === null) throw requisicaoInvalida('valorCentavos: Informe o valor pago.');
    // Só atualiza se ainda estiver pendente: dois cliques simultâneos não pagam duas vezes.
    const alterados = await trx('pagamento')
      .where({ id, usuarioId, status: 'pendente' })
      .update({ status: 'pago', dataPagamento: dataPagamento ?? hoje(), valorCentavos: valor });
    if (!alterados) throw jaPago();
    await cancelarLembretesPendentes(trx, id);
    await garantirProxima(trx, usuarioId, id);
    return buscar(usuarioId, id, trx);
  });
}

// Volta a conta para pendente (desfazer o ✓ da tela Hoje). A próxima da série, se já foi criada,
// fica: é o mesmo que editar a conta para pendente. Já pendente não muda nada.
async function desfazerPagamento(usuarioId, id) {
  return db.transaction(async (trx) => {
    await buscar(usuarioId, id, trx);
    await trx('pagamento')
      .where({ id, usuarioId, status: 'pago' })
      .update({ status: 'pendente', dataPagamento: null });
    return buscar(usuarioId, id, trx);
  });
}

async function remover(usuarioId, id) {
  await db.transaction(async (trx) => {
    const atual = await buscar(usuarioId, id, trx);
    if (atual.cartaoId) throw faturaAutomatica();
    await comprovantes.aoApagarContas(trx, [id]);
    // Conta da equipe apagada não é criada de novo naquele dia.
    if (atual.membroId) await dispensar(trx, atual.membroId, atual.vencimento);
    await trx('pagamento').where({ id, usuarioId }).del();
    await cancelarLembretesPendentes(trx, id);
  });
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  pagar,
  desfazerPagamento,
  remover,
  cancelarLembretesPendentes,
};
