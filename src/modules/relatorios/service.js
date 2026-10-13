const db = require('../../config/db');

const SEM_IMOVEL = 'Sem imóvel';

// Pago = status pago com data de pagamento no período.
// Previsto = pendente com vencimento no período.
async function gastos(usuarioId, { inicio, fim, agruparPor }) {
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
    q.join('categoriaPagamento as g', 'g.id', 'p.categoriaId')
      .select('g.id', 'g.nome')
      .groupBy('g.id', 'g.nome', 'g.ordem')
      .orderBy('g.ordem');
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
