// Consultas do assistente do WhatsApp: só leitura, nunca alteram nada. Segurança:
// - o `usuarioId` vem sempre do código (da conta ligada ao número que mandou a mensagem), nunca da
//   IA: as ferramentas não têm campo de conta, e toda consulta filtra por ele;
// - a IA só escolhe a ferramenta e os filtros, conferidos aqui por Zod estrito (campo a mais é
//   recusado); nomes de cartão, categoria e pessoa são procurados só nos cadastros dessa conta;
// - não há SQL livre: cada ferramenta é uma consulta fixa.
// O texto devolvido já vem pronto (R$ 1.234,56, DD/MM, no máximo 10 itens com o total), para a
// IA não precisar somar nem formatar. `ctx.valores` junta os textos da própria pessoa (descrições,
// nomes) que a resposta pode repetir: a proteção contra vazamento (protecao.js) não os confunde
// com informação técnica.
const { DateTime } = require('luxon');
const db = require('../../config/db');
const { z } = require('../../lib/zod');
const { requisicaoInvalida } = require('../../lib/erros');
const { FUSO } = require('../../lib/tempo');
const eventos = require('../eventos/service');
const medicamentos = require('../medicamentos/service');
const rotinas = require('../rotinas/service');
const tarefas = require('../tarefas/service');
const viagens = require('../viagens/service');
const compras = require('../compras/service');
const { emReais, diaCurto, normalizar, mesmoNome } = require('./formato');

const MAX_ITENS = 10;
const MAX_DIAS = 366;

// ——— Períodos ———

const PERIODOS = [
  'hoje',
  'ontem',
  'amanha',
  'esta_semana',
  'semana_passada',
  'proxima_semana',
  'este_mes',
  'mes_passado',
  'proximo_mes',
  'ultimos_7_dias',
  'ultimos_30_dias',
  'proximos_7_dias',
  'proximos_30_dias',
  'este_ano',
  'mes',
  'datas',
];

const nulo = (tipo, descricao, extra = {}) => ({ anyOf: [{ type: tipo, ...extra }, { type: 'null' }], description: descricao });

/** Campos de período das ferramentas. `opcional`: o período pode vir null (cada consulta tem o seu padrão). */
function camposPeriodo({ opcional = false, padrao = '' } = {}) {
  const descricao = `Semana = segunda a domingo. "mes" = um mês pelo nome (preencha mes e ano); "datas" = dia ou intervalo exato (preencha inicio e fim).${padrao}`;
  return {
    periodo: opcional ? nulo('string', descricao, { enum: PERIODOS }) : { type: 'string', enum: PERIODOS, description: descricao },
    mes: nulo('integer', 'Só com periodo "mes": 1 a 12 ("outubro" = 10).'),
    ano: nulo('integer', 'Só com periodo "mes": o ano; null = este ano.'),
    inicio: nulo('string', 'Só com periodo "datas": AAAA-MM-DD.'),
    fim: nulo('string', 'Só com periodo "datas": AAAA-MM-DD (um dia só: igual ao inicio).'),
  };
}

const zData = z.iso.date();
const zPeriodo = (opcional = false) => ({
  periodo: opcional ? z.enum(PERIODOS).nullish() : z.enum(PERIODOS),
  mes: z.number().int().min(1).max(12).nullish(),
  ano: z.number().int().min(2000).max(2100).nullish(),
  inicio: zData.nullish(),
  fim: zData.nullish(),
});

const hojeDe = (agora) => DateTime.fromMillis(agora, { zone: FUSO }).startOf('day');
const iso = (dt) => dt.toISODate();

/** Converte o período escolhido pela IA em datas (o código calcula, no fuso de Brasília). */
function resolverPeriodo({ periodo, mes, ano, inicio, fim }, agora) {
  const d = hojeDe(agora);
  const faixa = (a, b) => ({ inicio: iso(a), fim: iso(b) });
  const semana = (n) => faixa(d.plus({ weeks: n }).startOf('week'), d.plus({ weeks: n }).endOf('week'));
  const mesDe = (n) => faixa(d.plus({ months: n }).startOf('month'), d.plus({ months: n }).endOf('month'));
  switch (periodo) {
    case 'hoje':
      return faixa(d, d);
    case 'ontem':
      return faixa(d.minus({ days: 1 }), d.minus({ days: 1 }));
    case 'amanha':
      return faixa(d.plus({ days: 1 }), d.plus({ days: 1 }));
    case 'esta_semana':
      return semana(0);
    case 'semana_passada':
      return semana(-1);
    case 'proxima_semana':
      return semana(1);
    case 'este_mes':
      return mesDe(0);
    case 'mes_passado':
      return mesDe(-1);
    case 'proximo_mes':
      return mesDe(1);
    case 'ultimos_7_dias':
      return faixa(d.minus({ days: 6 }), d);
    case 'ultimos_30_dias':
      return faixa(d.minus({ days: 29 }), d);
    case 'proximos_7_dias':
      return faixa(d, d.plus({ days: 6 }));
    case 'proximos_30_dias':
      return faixa(d, d.plus({ days: 29 }));
    case 'este_ano':
      return faixa(d.startOf('year'), d.endOf('year'));
    case 'mes': {
      if (!mes) throw requisicaoInvalida('Faltou dizer qual mês. Pergunte à pessoa.');
      const primeiro = DateTime.fromObject({ year: ano ?? d.year, month: mes, day: 1 }, { zone: FUSO });
      return faixa(primeiro, primeiro.endOf('month'));
    }
    case 'datas': {
      if (!inicio) throw requisicaoInvalida('Faltou a data. Pergunte à pessoa.');
      const final = fim ?? inicio;
      if (final < inicio) throw requisicaoInvalida('A data final vem antes da inicial. Pergunte à pessoa.');
      const dias = DateTime.fromISO(final).diff(DateTime.fromISO(inicio), 'days').days;
      if (dias > MAX_DIAS) throw requisicaoInvalida('Período longo demais (no máximo 1 ano). Peça um período menor.');
      return { inicio, fim: final };
    }
    default:
      throw requisicaoInvalida('Período não reconhecido. Pergunte à pessoa qual período ela quer.');
  }
}

/** "hoje (10/11)", "em 12/11", "em outubro de 2026", "de 03/11 a 09/11". */
function rotulo({ inicio, fim }, agora) {
  const d = hojeDe(agora);
  const a = DateTime.fromISO(inicio, { zone: FUSO }).setLocale('pt-BR');
  const b = DateTime.fromISO(fim, { zone: FUSO });
  const dia = (x) => (x.year === d.year ? x.toFormat('dd/MM') : x.toFormat('dd/MM/yyyy'));
  if (inicio === fim) return inicio === iso(d) ? `hoje (${dia(a)})` : `em ${dia(a)}`;
  if (inicio === iso(a.startOf('month')) && fim === iso(a.endOf('month'))) return `em ${a.toFormat("LLLL 'de' yyyy")}`;
  return `de ${dia(a)} a ${dia(b)}`;
}

// ——— Ajudas de texto ———

/** Lista com no máximo 10 itens; com mais, diz o total e sugere filtrar. */
function lista(itens, formatar, sugestao) {
  const linhas = itens.slice(0, MAX_ITENS).map((item) => `• ${formatar(item)}`);
  if (itens.length > MAX_ITENS) {
    linhas.push(`(mostrando ${MAX_ITENS} de ${itens.length}${sugestao ? `; ofereça ${sugestao}` : ''})`);
  }
  return linhas.join('\n');
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const somar = (linhas, campo = 'valorCentavos') => linhas.reduce((s, l) => s + (l[campo] ?? 0), 0);
const valorOuADefinir = (centavos) => (centavos === null ? 'valor a definir' : emReais(centavos));
const anotar = (ctx, ...textos) => textos.forEach((t) => t && ctx.valores.add(String(t)));

const conferir = (esquema, entrada) => z.object(esquema).strict().parse(entrada ?? {});

// ——— Nomes dos cadastros (só os da própria conta) ———

async function categoriaDoNome(usuarioId, nome) {
  const lista_ = await db('categoriaPagamento').where({ usuarioId }).orderBy('ordem').select('id', 'nome');
  const achada = lista_.find((c) => mesmoNome(c.nome, nome));
  if (!achada) {
    throw requisicaoInvalida(`Não há a categoria "${nome}". As categorias são: ${lista_.map((c) => c.nome).join(', ')}.`);
  }
  return achada;
}

async function cartaoDoNome(usuarioId, nome) {
  const lista_ = await db('cartao').where({ usuarioId }).orderBy('ordem').select('id', 'nome');
  const procurado = normalizar(nome);
  const iguais = lista_.filter((c) => normalizar(c.nome) === procurado);
  const parecidos = iguais.length ? iguais : lista_.filter((c) => normalizar(c.nome).includes(procurado));
  if (parecidos.length === 1) return parecidos[0];
  const nomes = lista_.map((c) => c.nome).join(', ') || 'nenhum';
  if (parecidos.length > 1) throw requisicaoInvalida(`Há mais de um cartão com "${nome}" (${nomes}). Pergunte qual.`);
  throw requisicaoInvalida(`Não há cartão "${nome}" cadastrado. Cartões: ${nomes}.`);
}

async function membroDoNome(usuarioId, nome) {
  const lista_ = await db('membroEquipe').where({ usuarioId }).orderBy('nome').select('id', 'nome');
  const palavras = normalizar(nome).split(' ');
  const iguais = lista_.filter((m) => mesmoNome(m.nome, nome));
  const parecidos = iguais.length
    ? iguais
    : lista_.filter((m) => palavras.every((p) => normalizar(m.nome).split(' ').includes(p)));
  if (parecidos.length === 1) return parecidos[0];
  if (parecidos.length > 1) throw requisicaoInvalida(`Há mais de uma pessoa com "${nome}" na Equipe. Pergunte qual.`);
  throw requisicaoInvalida(`Não há "${nome}" na Equipe. Equipe: ${lista_.map((m) => m.nome).join(', ') || 'ninguém'}.`);
}

// Contas da pessoa, com o nome da categoria (fatura e equipe não têm: ganham o nome do grupo,
// como no Relatório do app).
const contas = (usuarioId) =>
  db('pagamento as p')
    .leftJoin('categoriaPagamento as g', 'g.id', 'p.categoriaId')
    .leftJoin('membroEquipe as e', 'e.id', 'p.membroId')
    .where('p.usuarioId', usuarioId)
    .select(
      'p.descricao',
      'p.valorCentavos',
      'p.vencimento',
      'p.dataPagamento',
      'p.status',
      'p.membroId',
      'e.nome as membroNome',
      db.raw(
        "COALESCE(g.nome, CASE WHEN p.membro_id IS NOT NULL THEN 'Salários equipe' ELSE 'Cartão de crédito' END) AS categoria",
      ),
    );

// ——— As consultas ———

/** Gastos pagos no período (pela data do pagamento, como o Relatório do app), ou compras de um cartão. */
async function consultarGastos(usuarioId, entrada, ctx) {
  const e = conferir({ ...zPeriodo(), categoria: z.string().min(1).nullish(), cartao: z.string().min(1).nullish() }, entrada);
  const periodo = resolverPeriodo(e, ctx.agora);
  const quando = rotulo(periodo, ctx.agora);
  if (e.cartao) return comprasDoCartao(usuarioId, e.cartao, periodo, quando, ctx);

  const categoria = e.categoria ? await categoriaDoNome(usuarioId, e.categoria) : null;
  const filtrar = (q) => (categoria ? q.where('p.categoriaId', categoria.id) : q);
  const [pagas, aPagar] = await Promise.all([
    filtrar(contas(usuarioId))
      .where('p.status', 'pago')
      .whereBetween('p.dataPagamento', [periodo.inicio, periodo.fim])
      .orderBy([{ column: 'p.dataPagamento', order: 'desc' }, 'p.descricao']),
    filtrar(contas(usuarioId))
      .where('p.status', 'pendente')
      .whereBetween('p.vencimento', [periodo.inicio, periodo.fim]),
  ]);
  pagas.forEach((p) => anotar(ctx, p.descricao, p.categoria));
  anotar(ctx, categoria?.nome);

  const de = categoria ? ` com ${categoria.nome}` : '';
  if (!pagas.length && !aPagar.length) return `Nenhum gasto${de} ${quando}.`;

  const partes = [`Gastos pagos${de} ${quando}: *${emReais(somar(pagas))}* (${plural(pagas.length, 'conta', 'contas')}).`];
  if (!categoria && pagas.length) {
    const porCategoria = new Map();
    for (const p of pagas) porCategoria.set(p.categoria, (porCategoria.get(p.categoria) ?? 0) + (p.valorCentavos ?? 0));
    const ordem = [...porCategoria].sort((a, b) => b[1] - a[1]);
    partes.push(`Por categoria: ${ordem.map(([nome, v]) => `${nome} ${emReais(v)}`).join('; ')}.`);
  }
  if (pagas.length) {
    const formatar = (p) => `${diaCurto(p.dataPagamento)} ${p.descricao}, ${emReais(p.valorCentavos)}${categoria ? '' : ` (${p.categoria})`}`;
    partes.push(lista(pagas, formatar, 'filtrar por categoria'));
  }
  if (aPagar.length) {
    partes.push(`Ainda a pagar no período: ${emReais(somar(aPagar))} (${plural(aPagar.length, 'conta', 'contas')}).`);
  }
  return partes.join('\n');
}

async function comprasDoCartao(usuarioId, nome, periodo, quando, ctx) {
  const cartao = await cartaoDoNome(usuarioId, nome);
  anotar(ctx, cartao.nome);
  const doCartao = await db('cartaoCompra as c')
    .join('cartao as k', 'k.id', 'c.cartaoId')
    .where({ 'k.usuarioId': usuarioId, 'c.cartaoId': cartao.id })
    .whereBetween('c.dataCompra', [periodo.inicio, periodo.fim])
    .orderBy([{ column: 'c.dataCompra', order: 'desc' }, 'c.descricao'])
    .select('c.descricao', 'c.valorTotalCentavos', 'c.parcelas', 'c.dataCompra');
  if (!doCartao.length) return `Nenhuma compra no cartão ${cartao.nome} ${quando}.`;
  doCartao.forEach((c) => anotar(ctx, c.descricao));
  const formatar = (c) => `${diaCurto(c.dataCompra)} ${c.descricao}, ${emReais(c.valorTotalCentavos)}${c.parcelas > 1 ? ` em ${c.parcelas}x` : ''}`;
  return [
    `Compras no cartão ${cartao.nome} ${quando}: *${emReais(somar(doCartao, 'valorTotalCentavos'))}* (${plural(doCartao.length, 'compra', 'compras')}; valor total de cada compra, parcelas somadas).`,
    lista(doCartao, formatar, 'um período menor'),
  ].join('\n');
}

/** Contas vencidas, a pagar ou pagas. */
async function consultarContas(usuarioId, entrada, ctx) {
  const e = conferir({ ...zPeriodo(true), situacao: z.enum(['vencidas', 'a_pagar', 'pagas']) }, entrada);
  const hoje = iso(hojeDe(ctx.agora));
  const padrao = { vencidas: null, a_pagar: 'proximos_30_dias', pagas: 'este_mes' }[e.situacao];
  const nomePeriodo = e.periodo ?? padrao;
  const periodo = nomePeriodo ? resolverPeriodo({ ...e, periodo: nomePeriodo }, ctx.agora) : null;
  const quando = periodo ? ` ${rotulo(periodo, ctx.agora)}` : '';

  const q = contas(usuarioId);
  if (e.situacao === 'pagas') {
    q.where('p.status', 'pago').whereBetween('p.dataPagamento', [periodo.inicio, periodo.fim]).orderBy('p.dataPagamento');
  } else {
    q.where('p.status', 'pendente').orderBy(['p.vencimento', 'p.descricao']);
    if (e.situacao === 'vencidas') q.where('p.vencimento', '<', hoje);
    if (periodo) q.whereBetween('p.vencimento', [periodo.inicio, periodo.fim]);
  }
  const linhas = await q;
  linhas.forEach((p) => anotar(ctx, p.descricao));

  const titulo = { vencidas: 'Contas vencidas (não pagas)', a_pagar: 'Contas a pagar', pagas: 'Contas pagas' }[e.situacao];
  if (!linhas.length) return `${titulo}${quando}: nenhuma.`;
  const aDefinir = linhas.filter((p) => p.valorCentavos === null).length;
  const total = `*${emReais(somar(linhas))}*${aDefinir ? ` (+ ${plural(aDefinir, 'conta', 'contas')} com valor a definir)` : ''}`;
  const formatar = (p) => {
    if (e.situacao === 'pagas') return `${diaCurto(p.dataPagamento)} ${p.descricao}, ${valorOuADefinir(p.valorCentavos)}`;
    const vencida = p.vencimento < hoje ? ' (vencida)' : '';
    return `vence ${diaCurto(p.vencimento)} ${p.descricao}, ${valorOuADefinir(p.valorCentavos)}${vencida}`;
  };
  return [`${titulo}${quando}: ${plural(linhas.length, 'conta', 'contas')}, total ${total}.`, lista(linhas, formatar, 'um período menor')].join(
    '\n',
  );
}

/** Pagamentos feitos à Equipe no período (todas as pessoas ou uma). */
async function consultarEquipe(usuarioId, entrada, ctx) {
  const e = conferir({ ...zPeriodo(), nome: z.string().min(1).nullish() }, entrada);
  const periodo = resolverPeriodo(e, ctx.agora);
  const quando = rotulo(periodo, ctx.agora);
  const membro = e.nome ? await membroDoNome(usuarioId, e.nome) : null;
  anotar(ctx, membro?.nome);

  const base = () => {
    const q = contas(usuarioId).whereNotNull('p.membroId');
    return membro ? q.where('p.membroId', membro.id) : q;
  };
  const [pagas, aPagar] = await Promise.all([
    base().where('p.status', 'pago').whereBetween('p.dataPagamento', [periodo.inicio, periodo.fim]).orderBy('p.dataPagamento'),
    base().where('p.status', 'pendente').whereBetween('p.vencimento', [periodo.inicio, periodo.fim]).orderBy('p.vencimento'),
  ]);
  [...pagas, ...aPagar].forEach((p) => anotar(ctx, p.membroNome));

  const para = membro ? ` a ${membro.nome}` : ' à Equipe';
  const partes = [];
  if (!pagas.length) partes.push(`Nenhum pagamento${para} ${quando}.`);
  else {
    partes.push(`Pago${para} ${quando}: *${emReais(somar(pagas))}* (${plural(pagas.length, 'pagamento', 'pagamentos')}).`);
    if (!membro) {
      const porPessoa = new Map();
      for (const p of pagas) porPessoa.set(p.membroNome, (porPessoa.get(p.membroNome) ?? 0) + (p.valorCentavos ?? 0));
      partes.push(`Por pessoa: ${[...porPessoa].map(([n, v]) => `${n} ${emReais(v)}`).join('; ')}.`);
    }
    partes.push(lista(pagas, (p) => `${diaCurto(p.dataPagamento)} ${p.membroNome}, ${emReais(p.valorCentavos)}`, 'filtrar por pessoa'));
  }
  if (aPagar.length) {
    const formatar = (p) => `vence ${diaCurto(p.vencimento)} ${p.membroNome}, ${valorOuADefinir(p.valorCentavos)}`;
    partes.push(`Ainda a pagar no período:\n${lista(aPagar, formatar)}`);
  }
  return partes.join('\n');
}

const horario = (isoInicio) => DateTime.fromISO(isoInicio, { zone: FUSO }).setLocale('pt-BR').toFormat("ccc dd/MM 'às' HH:mm");

/** Compromissos de um período, ou a procura de um pelo nome nos próximos 12 meses. */
async function consultarAgenda(usuarioId, entrada, ctx) {
  const e = conferir({ ...zPeriodo(true), busca: z.string().min(1).nullish() }, entrada);
  const formatar = (ev) => `${horario(ev.inicio)} ${ev.titulo}${ev.local ? ` (${ev.local})` : ''}`;
  const anotarTodos = (achados) => achados.forEach((ev) => anotar(ctx, ev.titulo, ev.local));

  if (e.busca) {
    const hoje = hojeDe(ctx.agora);
    const todos = await eventos.listar(usuarioId, { inicio: iso(hoje), fim: iso(hoje.plus({ days: MAX_DIAS - 1 })) });
    const procurado = normalizar(e.busca);
    const achados = todos.filter((ev) =>
      [ev.titulo, ev.tipoDescricao, ev.local, ev.tipo].some((t) => t && normalizar(t).includes(procurado)),
    );
    anotar(ctx, e.busca);
    if (!achados.length) return `Nenhum compromisso com "${e.busca}" nos próximos 12 meses.`;
    anotarTodos(achados);
    return [`Compromissos com "${e.busca}" (próximos 12 meses):`, lista(achados, formatar, 'um período')].join('\n');
  }

  const periodo = resolverPeriodo({ ...e, periodo: e.periodo ?? 'proximos_7_dias' }, ctx.agora);
  const quando = rotulo(periodo, ctx.agora);
  const doPeriodo = await eventos.listar(usuarioId, periodo);
  if (!doPeriodo.length) return `Nenhum compromisso ${quando}.`;
  anotarTodos(doPeriodo);
  return [`Compromissos ${quando}: ${doPeriodo.length}.`, lista(doPeriodo, formatar, 'um período menor')].join('\n');
}

const SITUACAO_REMEDIO = { tomado: 'tomado', nao_tomado: 'não tomado', pendente: 'a tomar' };
const PERIODO_REMEDIO = { manha: 'manhã', tarde: 'tarde', noite: 'noite', semanal: 'semanal' };

/** Doses de um dia: horário, dose e se já foi tomado. */
async function consultarRemedios(usuarioId, entrada, ctx) {
  const e = conferir({ data: zData.nullish() }, entrada);
  const data = e.data ?? iso(hojeDe(ctx.agora));
  const quando = rotulo({ inicio: data, fim: data }, ctx.agora);
  const doses = await medicamentos.doDia(usuarioId, { data });
  if (!doses.length) return `Nenhum remédio para tomar ${quando}.`;
  doses.forEach((d) => anotar(ctx, d.nome, d.dose, d.observacoes));
  const tomados = doses.filter((d) => d.situacao === 'tomado').length;
  const formatar = (d) => `${d.hora ?? PERIODO_REMEDIO[d.periodo]} ${d.nome}${d.dose ? ` ${d.dose}` : ''} — ${SITUACAO_REMEDIO[d.situacao]}`;
  return [`Remédios ${quando}: ${plural(doses.length, 'dose', 'doses')}, ${tomados} já ${tomados === 1 ? 'tomada' : 'tomadas'}.`, lista(doses, formatar)].join(
    '\n',
  );
}

/** Tarefas (pendentes, atrasadas, feitas) e, num dia só, a rotina do dia. */
async function consultarTarefas(usuarioId, entrada, ctx) {
  const e = conferir({ ...zPeriodo(true), situacao: z.enum(['pendentes', 'atrasadas', 'concluidas', 'todas']) }, entrada);
  const hoje = iso(hojeDe(ctx.agora));
  const formatar = (t) =>
    `${diaCurto(t.data)}${t.hora ? ` ${t.hora}` : ''} ${t.titulo}${t.concluida ? ' (feita)' : t.data < hoje ? ' (atrasada)' : ''}`;

  if (e.situacao === 'atrasadas') {
    const atrasadas = (await tarefas.listar(usuarioId, { situacao: 'pendente' })).filter((t) => t.data < hoje);
    atrasadas.forEach((t) => anotar(ctx, t.titulo));
    if (!atrasadas.length) return 'Nenhuma tarefa atrasada.';
    return [`Tarefas atrasadas: ${atrasadas.length}.`, lista(atrasadas, formatar)].join('\n');
  }

  const periodo = resolverPeriodo({ ...e, periodo: e.periodo ?? 'hoje' }, ctx.agora);
  const quando = rotulo(periodo, ctx.agora);
  const situacao = { pendentes: 'pendente', concluidas: 'concluida', todas: undefined }[e.situacao];
  const doPeriodo = await tarefas.listar(usuarioId, { ...periodo, situacao });
  doPeriodo.forEach((t) => anotar(ctx, t.titulo));
  const nome = { pendentes: 'Tarefas pendentes', concluidas: 'Tarefas feitas', todas: 'Tarefas' }[e.situacao];
  const partes = [doPeriodo.length ? `${nome} ${quando}: ${doPeriodo.length}.\n${lista(doPeriodo, formatar)}` : `${nome} ${quando}: nenhuma.`];

  if (periodo.inicio === periodo.fim) {
    const rotina = await rotinas.doDia(usuarioId, { data: periodo.inicio });
    rotina.forEach((r) => anotar(ctx, r.titulo));
    if (rotina.length) {
      const feitas = rotina.filter((r) => r.concluida).length;
      const formatarRotina = (r) => `${r.hora ? `${r.hora} ` : ''}${r.titulo}${r.concluida ? ' (feita)' : ''}`;
      partes.push(`Rotina do dia: ${feitas} de ${rotina.length} feitas.\n${lista(rotina, formatarRotina)}`);
    }
  }
  return partes.join('\n');
}

/** Próximas viagens (ou as últimas, se não houver próximas). */
async function consultarViagens(usuarioId, entrada, ctx) {
  conferir({}, entrada);
  const hoje = iso(hojeDe(ctx.agora));
  const todas = await viagens.listar(usuarioId);
  if (!todas.length) return 'Nenhuma viagem cadastrada.';
  todas.forEach((v) => anotar(ctx, v.destino, v.hospedagem, v.transporte));
  const formatar = (v) =>
    [
      `${diaCurto(v.ida)}${v.volta ? ` a ${diaCurto(v.volta)}` : ''} ${v.destino}`,
      v.hospedagem && `hospedagem: ${v.hospedagem}`,
      v.transporte && `transporte: ${v.transporte}`,
    ]
      .filter(Boolean)
      .join('; ');
  const proximas = todas.filter((v) => (v.volta ?? v.ida) >= hoje).sort((a, b) => a.ida.localeCompare(b.ida));
  if (proximas.length) return [`Próximas viagens: ${proximas.length}.`, lista(proximas, formatar)].join('\n');
  return ['Nenhuma viagem pela frente. Últimas:', lista(todas.slice(0, 3), formatar)].join('\n');
}

/** O que falta comprar na lista de compras. */
async function consultarCompras(usuarioId, entrada, ctx) {
  conferir({}, entrada);
  const itens = await compras.listar(usuarioId, { comprado: false });
  if (!itens.length) return 'A lista de compras está vazia (nada a comprar).';
  itens.forEach((i) => anotar(ctx, i.nome, i.quantidade, i.categoria));
  return [
    `Lista de compras: ${plural(itens.length, 'item', 'itens')} a comprar.`,
    lista(itens, (i) => `${i.nome}${i.quantidade ? ` (${i.quantidade})` : ''}`, 'ver o resto pelo app'),
  ].join('\n');
}

const juntarAte = (itens, formatar) =>
  `${itens.slice(0, MAX_ITENS).map(formatar).join('; ')}${itens.length > MAX_ITENS ? ` (e mais ${itens.length - MAX_ITENS})` : ''}`;

/** "Como está meu dia?" e "resumo da semana": agenda, remédios, rotina, tarefas e contas. */
async function resumo(usuarioId, entrada, ctx) {
  const e = conferir({ alcance: z.enum(['dia', 'semana']), data: zData.nullish() }, entrada);
  const hoje = iso(hojeDe(ctx.agora));
  const dia = e.data ?? hoje;
  const periodo =
    e.alcance === 'dia'
      ? { inicio: dia, fim: dia }
      : { inicio: iso(DateTime.fromISO(dia).startOf('week')), fim: iso(DateTime.fromISO(dia).endOf('week')) };
  const quando = rotulo(periodo, ctx.agora);
  const ateQuando = periodo.fim < hoje ? hoje : periodo.fim;

  const [agenda, pendentes, vencidas, aPagar, pagas] = await Promise.all([
    eventos.listar(usuarioId, periodo),
    tarefas.listar(usuarioId, { ...periodo, situacao: 'pendente' }),
    contas(usuarioId).where('p.status', 'pendente').where('p.vencimento', '<', hoje),
    contas(usuarioId).where('p.status', 'pendente').whereBetween('p.vencimento', [hoje, ateQuando]).orderBy('p.vencimento'),
    contas(usuarioId).where('p.status', 'pago').whereBetween('p.dataPagamento', [periodo.inicio, periodo.fim]),
  ]);
  agenda.forEach((ev) => anotar(ctx, ev.titulo));
  pendentes.forEach((t) => anotar(ctx, t.titulo));
  aPagar.forEach((p) => anotar(ctx, p.descricao));

  const hora = (ev) =>
    e.alcance === 'dia' ? DateTime.fromISO(ev.inicio, { zone: FUSO }).toFormat('HH:mm') : horario(ev.inicio);
  const partes = [`Resumo ${quando}:`];
  partes.push(`• Compromissos: ${agenda.length ? juntarAte(agenda, (ev) => `${hora(ev)} ${ev.titulo}`) : 'nenhum'}`);
  if (e.alcance === 'dia') {
    const [doses, rotina] = await Promise.all([medicamentos.doDia(usuarioId, { data: dia }), rotinas.doDia(usuarioId, { data: dia })]);
    if (doses.length) partes.push(`• Remédios: ${doses.filter((d) => d.situacao === 'tomado').length} de ${doses.length} doses tomadas`);
    if (rotina.length) partes.push(`• Rotina: ${rotina.filter((r) => r.concluida).length} de ${rotina.length} feitas`);
  }
  partes.push(`• Tarefas pendentes: ${pendentes.length ? juntarAte(pendentes, (t) => t.titulo) : 'nenhuma'}`);
  if (vencidas.length) partes.push(`• Contas vencidas: ${vencidas.length}, ${emReais(somar(vencidas))}`);
  partes.push(
    aPagar.length
      ? `• A pagar até ${diaCurto(ateQuando)}: ${aPagar.length}, ${emReais(somar(aPagar))} (${juntarAte(aPagar, (p) => `${p.descricao} ${diaCurto(p.vencimento)}`)})`
      : `• A pagar até ${diaCurto(ateQuando)}: nada`,
  );
  if (pagas.length) partes.push(`• Gasto ${e.alcance === 'dia' ? 'no dia' : 'na semana'}: ${emReais(somar(pagas))}`);
  return partes.join('\n');
}

// ——— Ferramentas (o que a IA vê) ———

const objeto = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

const FERRAMENTAS = [
  {
    name: 'consultar_gastos',
    description:
      'Quanto a pessoa gastou (contas pagas) num período, no total, por categoria ou numa categoria; ou as compras feitas num cartão de crédito ("o que passei no cartão Picpay?").',
    strict: true,
    input_schema: objeto({
      ...camposPeriodo(),
      categoria: nulo('string', 'Nome da categoria, se a pessoa pediu uma; null = todas.'),
      cartao: nulo('string', 'Nome do cartão, se a pergunta é sobre um cartão; null = não.'),
    }),
  },
  {
    name: 'consultar_contas',
    description: 'Contas a pagar: vencidas e não pagas ("tem conta atrasada?"), a vencer num período ("o que vence essa semana?") ou já pagas.',
    strict: true,
    input_schema: objeto({
      situacao: { type: 'string', enum: ['vencidas', 'a_pagar', 'pagas'] },
      ...camposPeriodo({ opcional: true, padrao: ' null = vencidas: todas; a_pagar: próximos 30 dias; pagas: este mês.' }),
    }),
  },
  {
    name: 'consultar_equipe',
    description: 'Pagamentos feitos à Equipe (funcionários) num período, de todos ou de uma pessoa ("quanto paguei ao Maurício em outubro?").',
    strict: true,
    input_schema: objeto({ ...camposPeriodo(), nome: nulo('string', 'Nome da pessoa da Equipe; null = todos.') }),
  },
  {
    name: 'consultar_agenda',
    description: 'Compromissos (consultas, exames, reuniões) de um dia ou período, ou a data de um compromisso pelo nome ("quando é minha consulta?").',
    strict: true,
    input_schema: objeto({
      ...camposPeriodo({ opcional: true, padrao: ' null = próximos 7 dias.' }),
      busca: nulo('string', 'Palavra para achar o compromisso pelo nome ("dentista", "consulta"); null = listar o período.'),
    }),
  },
  {
    name: 'consultar_remedios',
    description: 'Remédios de um dia: horários, doses e o que já foi tomado.',
    strict: true,
    input_schema: objeto({ data: nulo('string', 'AAAA-MM-DD; null = hoje.') }),
  },
  {
    name: 'consultar_tarefas',
    description: 'Tarefas pendentes, atrasadas ou feitas; num dia só, também a rotina do dia.',
    strict: true,
    input_schema: objeto({
      situacao: { type: 'string', enum: ['pendentes', 'atrasadas', 'concluidas', 'todas'] },
      ...camposPeriodo({ opcional: true, padrao: ' null = hoje (atrasadas: ignora o período).' }),
    }),
  },
  {
    name: 'consultar_viagens',
    description: 'Próximas viagens cadastradas (destino, datas, hospedagem, transporte).',
    strict: true,
    input_schema: objeto({}),
  },
  {
    name: 'consultar_compras',
    description: 'O que falta comprar na lista de compras.',
    strict: true,
    input_schema: objeto({}),
  },
  {
    name: 'resumo',
    description: 'Resumo do dia ("como está meu dia?") ou da semana ("resumo da semana"): compromissos, remédios, rotina, tarefas e contas.',
    strict: true,
    input_schema: objeto({
      alcance: { type: 'string', enum: ['dia', 'semana'] },
      data: nulo('string', 'AAAA-MM-DD do dia (ou de um dia da semana); null = hoje.'),
    }),
  },
];

const EXECUTAR = {
  consultar_gastos: consultarGastos,
  consultar_contas: consultarContas,
  consultar_equipe: consultarEquipe,
  consultar_agenda: consultarAgenda,
  consultar_remedios: consultarRemedios,
  consultar_tarefas: consultarTarefas,
  consultar_viagens: consultarViagens,
  consultar_compras: consultarCompras,
  resumo,
};

module.exports = { FERRAMENTAS, EXECUTAR, resolverPeriodo };
