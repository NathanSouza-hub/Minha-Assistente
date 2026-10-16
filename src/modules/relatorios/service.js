const db = require('../../config/db');
const { garantirContas } = require('../equipe/contas');

const SEM_IMOVEL = 'Sem imóvel';
const CARTAO_DE_CREDITO = 'Cartão de crédito';
const SALARIOS_EQUIPE = 'Salários equipe';

// Pago = status pago com data de pagamento no período.
// Previsto = pendente com vencimento no período.
async function gastos(usuarioId, { inicio, fim, agruparPor }) {
  // As contas da equipe do mês atual e do seguinte entram no previsto mesmo sem abrir Contas antes.
  await garantirContas(db, usuarioId);
  const pago = "p.status = 'pago' AND p.data_pagamento BETWEEN ? AND ?";
  const previsto = "p.status = 'pendente' AND p.vencimento BETWEEN ? AND ?";

  const q = db('pagamento as p')
    .where('p.usuarioId', usuarioId)
    .andWhere((w) => w.whereRaw(pago, [inicio, fim]).orWhereRaw(previsto, [inicio, fim]))
    .select(
      db.raw(`COALESCE(SUM(p.valor_centavos) FILTER (WHERE ${pago}), 0) AS pago_centavos`, [inicio, fim]),
      db.raw(`COALESCE(SUM(p.valor_centavos) FILTER (WHERE ${previsto}), 0) AS previsto_centavos`, [
        inicio,
        fim,
      ]),
    );

  if (agruparPor === 'categoria') {
    // Sem categoria: a equipe entra em "Salários equipe" e as faturas em "Cartão de crédito", no fim.
    q.leftJoin('categoriaPagamento as g', 'g.id', 'p.categoriaId')
      .select(
        'g.id',
        db.raw('COALESCE(g.nome, CASE WHEN p.membro_id IS NOT NULL THEN ? ELSE ? END) AS nome', [
          SALARIOS_EQUIPE,
          CARTAO_DE_CREDITO,
        ]),
      )
      .groupBy('g.id', 'g.nome', 'g.ordem')
      .groupByRaw('(p.membro_id IS NOT NULL)')
      .orderByRaw('g.ordem NULLS LAST, nome');
  } else {
    q.leftJoin('imovel as g', 'g.id', 'p.imovelId')
      .select('g.id', db.raw('COALESCE(g.nome, ?) AS nome', [SEM_IMOVEL]))
      .groupBy('g.id', 'g.nome', 'g.ordem')
      .orderByRaw('g.ordem NULLS LAST, g.nome NULLS LAST');
  }

  const linhas = await q;
  const itens = linhas.map(({ id, nome, pagoCentavos, previstoCentavos }) => ({
    id,
    nome,
    pagoCentavos,
    previstoCentavos,
  }));

  return {
    inicio,
    fim,
    agruparPor,
    totalPagoCentavos: itens.reduce((soma, i) => soma + i.pagoCentavos, 0),
    totalPrevistoCentavos: itens.reduce((soma, i) => soma + i.previstoCentavos, 0),
    itens,
  };
}

module.exports = { gastos };
