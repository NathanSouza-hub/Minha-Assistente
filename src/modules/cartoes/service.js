const { DateTime } = require('luxon');
const db = require('../../config/db');
const { hoje } = require('../../lib/tempo');
const { AppError, naoEncontrado, requisicaoInvalida } = require('../../lib/erros');
const {
  datasDaCompetencia,
  primeiraCompetencia,
  parcelasDaCompra,
  situacaoDaFatura,
  somarMeses,
} = require('../../lib/fatura');
const { cancelarLembretesPendentes } = require('../pagamentos/service');

const CAMPOS_CARTAO = ['id', 'nome', 'final', 'cor', 'diaFechamento', 'diaVencimento', 'limiteCentavos', 'ordem'];
const CAMPOS_COMPRA = [
  'id',
  'cartaoId',
  'descricao',
  'categoriaId',
  'valorTotalCentavos',
  'parcelas',
  'dataCompra',
  'observacoes',
];

const nomeDoMes = (competencia) =>
  DateTime.fromISO(competencia).setLocale('pt-BR').toFormat("LLLL 'de' yyyy");

const faturaPaga = (competencia) =>
  new AppError(409, 'FATURA_PAGA', `A mudança mexe na fatura de ${nomeDoMes(competencia)}, que já foi paga.`);

const descricaoDaFatura = (cartao) => `Fatura ${cartao.nome}`;

// FOR UPDATE: escritas no mesmo cartão esperam umas pelas outras, e a soma das faturas não se perde.
async function buscarCartao(conexao, usuarioId, id, { travar = false } = {}) {
  const q = conexao('cartao').select(CAMPOS_CARTAO).where({ id, usuarioId }).first();
  if (travar) q.forUpdate();
  const cartao = await q;
  if (!cartao) throw naoEncontrado('Cartão');
  return cartao;
}

const comprasDoCartao = (conexao, cartaoId) =>
  conexao('cartaoCompra as cc')
    .leftJoin('categoriaPagamento as c', 'c.id', 'cc.categoriaId')
    .where('cc.cartaoId', cartaoId)
    .select([...CAMPOS_COMPRA.map((campo) => `cc.${campo}`), 'c.nome as categoriaNome'])
    .orderBy([{ column: 'cc.dataCompra' }, { column: 'cc.criadoEm' }]);

const parcelasDe = (cartao, compras) =>
  compras.flatMap((compra) => parcelasDaCompra(cartao, compra).map((parcela) => ({ compra, ...parcela })));

function somarPorCompetencia(parcelas) {
  const somas = new Map();
  for (const { competencia, valorCentavos } of parcelas) {
    somas.set(competencia, (somas.get(competencia) ?? 0) + valorCentavos);
  }
  return somas;
}

// Contas de fatura do cartão, por competência.
async function contasDoCartao(conexao, cartaoId) {
  const contas = await conexao('pagamento')
    .where({ cartaoId })
    .select('id', 'competencia', 'status', 'valorCentavos', 'vencimento', 'descricao');
  return new Map(contas.map((c) => [c.competencia, c]));
}

// Recalcula todas as faturas do cartão e deixa as contas iguais às compras. Fatura paga não muda:
// se o valor dela mudaria, a operação inteira é recusada (a transação desfaz tudo).
async function sincronizar(trx, usuarioId, cartao) {
  const somas = somarPorCompetencia(parcelasDe(cartao, await comprasDoCartao(trx, cartao.id)));
  const contas = await contasDoCartao(trx, cartao.id);
  const competencias = [...new Set([...somas.keys(), ...contas.keys()])].sort();

  for (const competencia of competencias) {
    const total = somas.get(competencia) ?? 0;
    const conta = contas.get(competencia);

    if (conta?.status === 'pago') {
      if (conta.valorCentavos !== total) throw faturaPaga(competencia);
      continue;
    }
    if (!conta) {
      if (total > 0) {
        await trx('pagamento').insert({
          usuarioId,
          cartaoId: cartao.id,
          competencia,
          descricao: descricaoDaFatura(cartao),
          valorCentavos: total,
          vencimento: datasDaCompetencia(cartao, competencia).vencimento,
        });
      }
      continue;
    }
    if (total === 0) {
      await trx('pagamento').where({ id: conta.id }).del();
      await cancelarLembretesPendentes(trx, conta.id);
      continue;
    }
    const mudancas = {
      valorCentavos: total,
      vencimento: datasDaCompetencia(cartao, competencia).vencimento,
      descricao: descricaoDaFatura(cartao),
    };
    if (Object.entries(mudancas).some(([campo, valor]) => conta[campo] !== valor)) {
      await trx('pagamento').where({ id: conta.id }).update(mudancas);
      await cancelarLembretesPendentes(trx, conta.id);
    }
  }
}

// Primeira fatura não paga a partir do mês atual: uma já fechada e pendente, ou a que recebe
// as compras de hoje.
function faturaAtual(cartao, somas, contas, dataDeHoje) {
  const aberta = primeiraCompetencia(cartao, dataDeHoje);
  let competencia = `${dataDeHoje.slice(0, 7)}-01`;
  for (;;) {
    const pago = contas.get(competencia)?.status === 'pago';
    const total = somas.get(competencia) ?? 0;
    if (!pago && (total > 0 || competencia >= aberta)) break;
    competencia = somarMeses(competencia, 1);
  }
  const { fechamento, vencimento } = datasDaCompetencia(cartao, competencia);
  return {
    competencia,
    totalCentavos: somas.get(competencia) ?? 0,
    vencimento,
    situacao: situacaoDaFatura({ fechamento, pago: false }, dataDeHoje),
  };
}

async function detalhar(conexao, cartao) {
  const parcelas = parcelasDe(cartao, await comprasDoCartao(conexao, cartao.id));
  const contas = await contasDoCartao(conexao, cartao.id);
  const naoPagas = parcelas.filter((p) => contas.get(p.competencia)?.status !== 'pago');
  return {
    ...cartao,
    limiteDisponivelCentavos:
      cartao.limiteCentavos === null
        ? null
        : cartao.limiteCentavos - naoPagas.reduce((soma, p) => soma + p.valorCentavos, 0),
    faturaAtual: faturaAtual(cartao, somarPorCompetencia(parcelas), contas, hoje()),
  };
}

async function listar(usuarioId) {
  const cartoes = await db('cartao')
    .select(CAMPOS_CARTAO)
    .where({ usuarioId })
    .orderBy([{ column: 'ordem' }, { column: 'nome' }]);
  return Promise.all(cartoes.map((cartao) => detalhar(db, cartao)));
}

async function buscar(usuarioId, id) {
  return detalhar(db, await buscarCartao(db, usuarioId, id));
}

async function comDuplicado(operacao) {
  try {
    return await operacao();
  } catch (erro) {
    if (erro.code === '23505') {
      throw new AppError(409, 'CARTAO_DUPLICADO', 'Você já tem um cartão com esse nome.');
    }
    throw erro;
  }
}

const camposCartao = (d) => ({
  nome: d.nome,
  final: d.final,
  cor: d.cor,
  diaFechamento: d.diaFechamento,
  diaVencimento: d.diaVencimento,
  limiteCentavos: d.limiteCentavos,
  ...(d.ordem !== undefined && { ordem: d.ordem }),
});

// Sem ordem, o cartão novo vai para o fim.
const criar = (usuarioId, dados) =>
  comDuplicado(async () => {
    const [cartao] = await db('cartao')
      .insert({
        ...camposCartao(dados),
        usuarioId,
        ordem:
          dados.ordem ??
          db('cartao').where({ usuarioId }).select(db.raw('COALESCE(MAX(ordem), 0) + 1')),
      })
      .returning(CAMPOS_CARTAO);
    return detalhar(db, cartao);
  });

const atualizar = (usuarioId, id, dados) =>
  comDuplicado(() =>
    db.transaction(async (trx) => {
      await buscarCartao(trx, usuarioId, id, { travar: true });
      const [cartao] = await trx('cartao').where({ id, usuarioId }).update(camposCartao(dados)).returning(CAMPOS_CARTAO);
      await sincronizar(trx, usuarioId, cartao);
      return detalhar(trx, cartao);
    }),
  );

async function remover(usuarioId, id) {
  await db.transaction(async (trx) => {
    await buscarCartao(trx, usuarioId, id, { travar: true });
    if (await trx('pagamento').where({ cartaoId: id, status: 'pago' }).first('id')) {
      throw new AppError(409, 'REFERENCIA_INVALIDA', 'O cartão tem faturas pagas no histórico.');
    }
    const pendentes = await trx('pagamento').where({ cartaoId: id }).del().returning('id');
    for (const { id: contaId } of pendentes) await cancelarLembretesPendentes(trx, contaId);
    await trx('cartao').where({ id, usuarioId }).del();
  });
}

async function fatura(usuarioId, id, competencia) {
  const cartao = await buscarCartao(db, usuarioId, id);
  const parcelas = parcelasDe(cartao, await comprasDoCartao(db, id)).filter((p) => p.competencia === competencia);
  const conta = (await contasDoCartao(db, id)).get(competencia);
  const { fechamento, vencimento } = datasDaCompetencia(cartao, competencia);
  return {
    competencia,
    fechamento,
    vencimento,
    situacao: situacaoDaFatura({ fechamento, pago: conta?.status === 'pago' }, hoje()),
    totalCentavos: parcelas.reduce((soma, p) => soma + p.valorCentavos, 0),
    pagamentoId: conta?.id ?? null,
    parcelas: parcelas.map(({ compra, parcela, totalParcelas, valorCentavos }) => ({
      compraId: compra.id,
      descricao: compra.descricao,
      categoriaId: compra.categoriaId,
      categoriaNome: compra.categoriaNome,
      dataCompra: compra.dataCompra,
      parcela,
      totalParcelas,
      valorCentavos,
    })),
  };
}

async function validarCategoria(trx, usuarioId, categoriaId) {
  if (!categoriaId) return;
  const categoria = await trx('categoriaPagamento').where({ id: categoriaId, usuarioId }).first('id');
  if (!categoria) throw requisicaoInvalida('categoriaId: categoria não encontrada.');
}

const camposCompra = (d) => ({
  descricao: d.descricao,
  valorTotalCentavos: d.valorTotalCentavos,
  parcelas: d.parcelas,
  dataCompra: d.dataCompra,
  categoriaId: d.categoriaId,
  observacoes: d.observacoes,
});

const comCompetencias = (cartao, compra) => ({
  ...compra,
  competencias: parcelasDaCompra(cartao, compra).map((p) => p.competencia),
});

async function buscarCompra(usuarioId, cartaoId, compraId) {
  const cartao = await buscarCartao(db, usuarioId, cartaoId);
  const compra = await db('cartaoCompra').select(CAMPOS_COMPRA).where({ id: compraId, cartaoId }).first();
  if (!compra) throw naoEncontrado('Compra', { feminino: true });
  return comCompetencias(cartao, compra);
}

async function criarCompra(usuarioId, cartaoId, dados) {
  return db.transaction(async (trx) => {
    const cartao = await buscarCartao(trx, usuarioId, cartaoId, { travar: true });
    await validarCategoria(trx, usuarioId, dados.categoriaId);
    const [compra] = await trx('cartaoCompra')
      .insert({ ...camposCompra(dados), cartaoId })
      .returning(CAMPOS_COMPRA);
    await sincronizar(trx, usuarioId, cartao);
    return comCompetencias(cartao, compra);
  });
}

async function atualizarCompra(usuarioId, cartaoId, compraId, dados) {
  return db.transaction(async (trx) => {
    const cartao = await buscarCartao(trx, usuarioId, cartaoId, { travar: true });
    await validarCategoria(trx, usuarioId, dados.categoriaId);
    const [compra] = await trx('cartaoCompra')
      .where({ id: compraId, cartaoId })
      .update(camposCompra(dados))
      .returning(CAMPOS_COMPRA);
    if (!compra) throw naoEncontrado('Compra', { feminino: true });
    await sincronizar(trx, usuarioId, cartao);
    return comCompetencias(cartao, compra);
  });
}

async function removerCompra(usuarioId, cartaoId, compraId) {
  await db.transaction(async (trx) => {
    const cartao = await buscarCartao(trx, usuarioId, cartaoId, { travar: true });
    const apagadas = await trx('cartaoCompra').where({ id: compraId, cartaoId }).del();
    if (!apagadas) throw naoEncontrado('Compra', { feminino: true });
    await sincronizar(trx, usuarioId, cartao);
  });
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  remover,
  fatura,
  buscarCompra,
  criarCompra,
  atualizarCompra,
  removerCompra,
};
