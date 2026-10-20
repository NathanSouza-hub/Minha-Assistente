const db = require('../../config/db');
const { garantirContas } = require('../equipe/contas');
const { ORIGENS } = require('../recebiveis/schema');
const imoveis = require('../imoveis/service');
const { DateTime } = require('luxon');

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

// Contas com vencimento no período (competência = vencimento), por situação. Valor nulo (equipe a
// definir) soma 0. Nada conta duas vezes: cada conta tem no máximo um imóvel e as compras de
// cartão só entram pela fatura.
const SOMAS_CONTAS = [
  'COALESCE(SUM(p.valor_centavos), 0) AS total_centavos',
  "COALESCE(SUM(p.valor_centavos) FILTER (WHERE p.status = 'pago'), 0) AS pago_centavos",
  "COALESCE(SUM(p.valor_centavos) FILTER (WHERE p.status = 'pendente'), 0) AS pendente_centavos",
  "COALESCE(SUM(p.valor_centavos) FILTER (WHERE p.status = 'pendente' AND p.vencimento < current_date), 0) AS vencido_centavos",
];

const valores = (linha) => ({
  totalCentavos: linha?.totalCentavos ?? 0,
  pagoCentavos: linha?.pagoCentavos ?? 0,
  pendenteCentavos: linha?.pendenteCentavos ?? 0,
  vencidoCentavos: linha?.vencidoCentavos ?? 0,
});

// Recebíveis com data prevista no período, pela origem: previsto, já recebido, saldo a receber e
// saldo vencido. Mais o realizado: recebimentos com data no período, de qualquer recebível.
async function entradasDoPeriodo(usuarioId, inicio, fim) {
  const { rows } = await db.raw(
    `WITH r AS (
       SELECT r.origem, r.valor_previsto_centavos AS previsto, r.data_prevista,
              (r.encerrado OR m.recebido >= r.valor_previsto_centavos) AS quitado, m.recebido
       FROM recebivel r
       CROSS JOIN LATERAL (
         SELECT COALESCE(SUM(valor_centavos), 0) AS recebido FROM recebimento WHERE recebivel_id = r.id
       ) m
       WHERE r.usuario_id = ? AND r.data_prevista BETWEEN ? AND ?
     )
     SELECT origem,
            SUM(previsto) AS total_centavos,
            SUM(recebido) AS recebido_centavos,
            SUM(CASE WHEN quitado THEN 0 ELSE previsto - recebido END) AS pendente_centavos,
            SUM(CASE WHEN NOT quitado AND data_prevista < current_date THEN previsto - recebido ELSE 0 END)
              AS vencido_centavos
     FROM r GROUP BY origem`,
    [usuarioId, inicio, fim],
  );
  const realizado = await db('recebimento as m')
    .join('recebivel as r', 'r.id', 'm.recebivelId')
    .where('r.usuarioId', usuarioId)
    .whereBetween('m.data', [inicio, fim])
    .first(db.raw('COALESCE(SUM(m.valor_centavos), 0) AS centavos'));

  const porOrigem = ORIGENS.map((origem) => rows.find((l) => l.origem === origem)).filter(Boolean);
  const somar = (campo) => porOrigem.reduce((soma, l) => soma + l[campo], 0);
  return {
    totalCentavos: somar('totalCentavos'),
    recebidoCentavos: somar('recebidoCentavos'),
    pendenteCentavos: somar('pendenteCentavos'),
    vencidoCentavos: somar('vencidoCentavos'),
    recebidoNoPeriodoCentavos: realizado.centavos,
    porOrigem: porOrigem.map(({ origem, totalCentavos, recebidoCentavos, pendenteCentavos }) => ({
      origem,
      totalCentavos,
      recebidoCentavos,
      pendenteCentavos,
    })),
  };
}

// Visão financeira do período: as contas que vencem nele (quanto já foi pago, está pendente ou
// vencido), o realizado (pago no período, pela data do pagamento), cada imóvel e as despesas
// pessoais (sem imóvel) por categoria.
async function financeiro(usuarioId, { inicio, fim }) {
  await garantirContas(db, usuarioId);
  const doPeriodo = () =>
    db('pagamento as p').where('p.usuarioId', usuarioId).whereBetween('p.vencimento', [inicio, fim]);
  const somas = () => SOMAS_CONTAS.map((s) => db.raw(s));

  const [geral, realizado, porImovel, pessoal, categorias, imoveis] = await Promise.all([
    doPeriodo().first(
      ...somas(),
      db.raw('COUNT(*) FILTER (WHERE p.valor_centavos IS NULL)::int AS contas_a_definir'),
    ),
    db('pagamento as p')
      .where({ 'p.usuarioId': usuarioId, 'p.status': 'pago' })
      .whereBetween('p.dataPagamento', [inicio, fim])
      .first(db.raw('COALESCE(SUM(p.valor_centavos), 0) AS centavos')),
    doPeriodo().whereNotNull('p.imovelId').select('p.imovelId', ...somas()).groupBy('p.imovelId'),
    doPeriodo().whereNull('p.imovelId').first(...somas()),
    doPeriodo()
      .whereNull('p.imovelId')
      .leftJoin('categoriaPagamento as g', 'g.id', 'p.categoriaId')
      .select(
        'g.id',
        db.raw('COALESCE(g.nome, CASE WHEN p.membro_id IS NOT NULL THEN ? ELSE ? END) AS nome', [
          SALARIOS_EQUIPE,
          CARTAO_DE_CREDITO,
        ]),
        db.raw('COALESCE(SUM(p.valor_centavos), 0) AS total_centavos'),
      )
      .groupBy('g.id', 'g.nome', 'g.ordem')
      .groupByRaw('(p.membro_id IS NOT NULL)')
      .orderByRaw('g.ordem NULLS LAST, nome'),
    db('imovel').where({ usuarioId }).orderBy(['ordem', 'nome']).select('id', 'nome'),
  ]);

  const saidas = {
    ...valores(geral),
    pagoNoPeriodoCentavos: realizado.centavos,
    contasADefinir: geral.contasADefinir,
  };
  const entradas = await entradasDoPeriodo(usuarioId, inicio, fim);

  return {
    inicio,
    fim,
    saidas,
    entradas,
    saldo: {
      realizadoCentavos: entradas.recebidoNoPeriodoCentavos - saidas.pagoNoPeriodoCentavos,
      projetadoCentavos: entradas.totalCentavos - saidas.totalCentavos,
    },
    imoveis: imoveis.map(({ id, nome }) => ({ id, nome, ...valores(porImovel.find((l) => l.imovelId === id)) })),
    pessoal: {
      ...valores(pessoal),
      categorias: categorias.map(({ id, nome, totalCentavos }) => ({ id, nome, totalCentavos })),
    },
  };
}

// Meses AAAA-MM de inicio a fim (inclusive), para a evolução não pular mês sem conta.
function mesesDoPeriodo(inicio, fim) {
  const meses = [];
  for (let m = DateTime.fromISO(inicio).startOf('month'); m <= DateTime.fromISO(fim); m = m.plus({ months: 1 })) {
    meses.push(m.toFormat('yyyy-MM'));
  }
  return meses;
}

// Resumo de um imóvel no período, só das contas dele (vencimento no período): situação, por
// categoria, mês a mês e quantos comprovantes. Imóvel de outro usuário → 404.
async function imovel(usuarioId, id, { inicio, fim }) {
  const dados = await imoveis.buscar(usuarioId, id);
  const doPeriodo = () =>
    db('pagamento as p')
      .where({ 'p.usuarioId': usuarioId, 'p.imovelId': id })
      .whereBetween('p.vencimento', [inicio, fim]);
  const somas = () => SOMAS_CONTAS.map((s) => db.raw(s));

  const [geral, categorias, porMes, comprovantes] = await Promise.all([
    doPeriodo().first(...somas()),
    doPeriodo()
      .leftJoin('categoriaPagamento as g', 'g.id', 'p.categoriaId')
      .select(
        'g.id',
        db.raw("COALESCE(g.nome, 'Sem categoria') AS nome"),
        db.raw('COALESCE(SUM(p.valor_centavos), 0) AS total_centavos'),
        db.raw("COALESCE(SUM(p.valor_centavos) FILTER (WHERE p.status = 'pago'), 0) AS pago_centavos"),
      )
      .groupBy('g.id', 'g.nome', 'g.ordem')
      .orderByRaw('g.ordem NULLS LAST, nome'),
    doPeriodo()
      .select(
        db.raw("to_char(p.vencimento, 'YYYY-MM') AS mes"),
        db.raw('COALESCE(SUM(p.valor_centavos), 0) AS total_centavos'),
        db.raw("COALESCE(SUM(p.valor_centavos) FILTER (WHERE p.status = 'pago'), 0) AS pago_centavos"),
      )
      .groupByRaw("to_char(p.vencimento, 'YYYY-MM')"),
    doPeriodo()
      .join('pagamentoComprovante as c', 'c.pagamentoId', 'p.id')
      .first(db.raw('COUNT(*)::int AS total')),
  ]);

  return {
    inicio,
    fim,
    imovel: dados,
    ...valores(geral),
    totalComprovantes: comprovantes.total,
    categorias: categorias.map(({ id: categoriaId, nome, totalCentavos, pagoCentavos }) => ({
      id: categoriaId,
      nome,
      totalCentavos,
      pagoCentavos,
    })),
    meses: mesesDoPeriodo(inicio, fim).map((mes) => {
      const linha = porMes.find((l) => l.mes === mes);
      return { mes, totalCentavos: linha?.totalCentavos ?? 0, pagoCentavos: linha?.pagoCentavos ?? 0 };
    }),
  };
}

module.exports = { gastos, financeiro, imovel };
