// Assistente do WhatsApp, fase 2 (decisão 38): o Claude Haiku entende a mensagem de quem ligou o
// número ("almoço 45,90", "dentista dia 18 às 15h") e lança no app chamando os services dos módulos
// por tool use. Cada ferramenta valida com o mesmo esquema Zod das rotas, então o que entra por aqui
// obedece às mesmas regras do app. O que foi lançado fica em whatsapp_lancamento para o "desfazer".
// Ajustes de 2026-10-29 (migration 35): categoria escolhida entre as padrão, "crédito Itaú" vira
// compra no cartão cadastrado, nome de alguém da Equipe paga a conta dela, trocar a categoria do
// último lançamento, e valor acima de WHATSAPP_CONFIRMAR_ACIMA_CENTAVOS espera o "SIM".
const { ZodError } = require('zod');
const db = require('../../config/db');
const env = require('../../config/env');
const claude = require('../../lib/claude');
const { requisicaoInvalida } = require('../../lib/erros');
const { FUSO } = require('../../lib/tempo');
const { DateTime } = require('luxon');
const pagamentos = require('../pagamentos/service');
const esquemaPagamento = require('../pagamentos/schema');
const eventos = require('../eventos/service');
const esquemaEvento = require('../eventos/schema');
const tarefas = require('../tarefas/service');
const esquemaTarefa = require('../tarefas/schema');
const categorias = require('../categorias/service');
const esquemaCategoria = require('../categorias/schema');
const cartoes = require('../cartoes/service');
const esquemaCartao = require('../cartoes/schema');
const { garantirContas } = require('../equipe/contas');

const MODELO = 'claude-haiku-5-5';
// Voltas do laço de ferramentas por mensagem (cada volta é uma chamada à API).
const MAX_VOLTAS = 5;
// A conversa que o Claude vê: as últimas falas da última meia hora.
const HISTORICO_FALAS = 10;
const HISTORICO_MS = 30 * 60_000;
// "Desfazer" só alcança o que foi lançado nas últimas 24 h.
const DESFAZER_MS = 24 * 60 * 60_000;
// O "SIM" vale para o que ficou esperando confirmação nos últimos 30 min.
const CONFIRMAR_MS = 30 * 60_000;

const TEXTOS = {
  falhou: 'Não consegui entender agora. Tente de novo em instantes ou lance pelo app.',
  recusou: 'Não posso ajudar com isso por aqui. Posso anotar contas, compromissos e tarefas.',
  nadaParaDesfazer: 'Não achei nada lançado por aqui nas últimas 24 horas para desfazer.',
  naoLancado: 'Tudo bem, não lancei.',
};

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const emReais = (centavos) => reais.format(centavos / 100);
const diaCurto = (iso) => DateTime.fromISO(iso, { zone: FUSO }).toFormat('dd/MM');
// Para comparar nomes sem diferenciar maiúsculas e acentos ("itau" acha "Itaú").
const normalizar = (texto) =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const nulo = (tipo, descricao) => ({ anyOf: [{ type: tipo }, { type: 'null' }], description: descricao });

const FERRAMENTAS = [
  {
    name: 'lancar_conta',
    description:
      'Anota um gasto já pago ("almoço 45,90", "paguei a luz 230") ou uma conta a pagar ("IPTU 800 vence dia 10") nas Finanças da pessoa.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['descricao', 'valor_centavos', 'data', 'situacao', 'categoria', 'cartao', 'parcelas'],
      properties: {
        descricao: {
          type: 'string',
          description: 'Do que é, curto ("Cinema", "Almoço na praia"), sem a forma de pagamento (pix, débito, crédito, nome do cartão).',
        },
        valor_centavos: { type: 'integer', description: 'Valor total em centavos: "45,90" = 4590; "1.200" = 120000.' },
        data: { type: 'string', format: 'date', description: 'pago ou compra no cartão: o dia; pendente: vencimento. AAAA-MM-DD.' },
        situacao: { type: 'string', enum: ['pago', 'pendente'] },
        categoria: { type: 'string', description: 'Nome exato de uma das categorias da pessoa; "Outros" se nenhuma servir.' },
        cartao: nulo('string', 'Nome do cartão de crédito usado ("crédito Itaú" = "Itaú"); null se não foi no crédito.'),
        parcelas: nulo('integer', 'Só no cartão, se a pessoa disse ("em 3x" = 3); null = à vista.'),
      },
    },
  },
  {
    name: 'pagar_equipe',
    description:
      'Registra o pagamento de alguém da Equipe da pessoa ("Maurício cuidador 3300"): marca como paga a conta pendente mais antiga dessa pessoa.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['nome', 'valor_centavos', 'data'],
      properties: {
        nome: { type: 'string', description: 'Nome como está na lista da Equipe.' },
        valor_centavos: nulo('integer', 'Valor pago em centavos; null se a pessoa não disse (vale o previsto).'),
        data: { type: 'string', format: 'date', description: 'Dia do pagamento; sem dia dito, hoje. AAAA-MM-DD.' },
      },
    },
  },
  {
    name: 'trocar_categoria_ultimo',
    description:
      'Desfaz o último lançamento de gasto e lança de novo, igual, em outra categoria ("desfazer, categoria alimentação", "era lazer").',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['categoria'],
      properties: { categoria: { type: 'string', description: 'A categoria nova, como a pessoa disse.' } },
    },
  },
  {
    name: 'criar_categoria',
    description: 'Cria uma categoria nova. Só depois que a pessoa disser que quer criar.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['nome'],
      properties: { nome: { type: 'string', description: 'Nome curto, com a primeira letra maiúscula ("Almoço").' } },
    },
  },
  {
    name: 'criar_compromisso',
    description: 'Põe na agenda uma consulta, exame, reunião ou outro compromisso com dia e hora.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['titulo', 'inicio', 'tipo', 'local', 'lembrete_minutos_antes'],
      properties: {
        titulo: { type: 'string', description: 'Ex.: "Dentista", "Reunião com Marcos".' },
        inicio: { type: 'string', format: 'date-time', description: 'Com o fuso de Brasília: 2026-11-18T15:00:00-03:00.' },
        tipo: {
          type: 'string',
          enum: ['consulta', 'exame', 'fisioterapia', 'reuniao_pessoal', 'atividade_fisica', 'entrevista', 'outro'],
        },
        local: nulo('string', 'Onde, se a pessoa disse.'),
        lembrete_minutos_antes: nulo('integer', 'Só se a pessoa pedir um aviso diferente; null = 1 hora antes.'),
      },
    },
  },
  {
    name: 'criar_tarefa',
    description: 'Anota uma tarefa ou lembrete de fazer algo num dia ("ligar para o banco amanhã").',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['titulo', 'data', 'hora'],
      properties: {
        titulo: { type: 'string' },
        data: { type: 'string', format: 'date', description: 'AAAA-MM-DD; sem dia dito, hoje.' },
        hora: nulo('string', '"HH:MM" se a pessoa disse a hora (aí ela recebe aviso na hora).'),
      },
    },
  },
  {
    name: 'desfazer_ultimo',
    description: 'Apaga o último lançamento feito por esta conversa, quando a pessoa pedir para desfazer ou disser que errou.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
];

const ouNenhum = (nomes) => (nomes.length ? nomes.join(', ') : 'nenhum');

function sistema(usuario, { categorias: nomesDasCategorias, cartoes: nomesDosCartoes, equipe }, agora) {
  const momento = DateTime.fromMillis(agora, { zone: FUSO }).setLocale('pt-BR');
  return `Você é a Minha Assistente, secretária pessoal de ${usuario.nome}, respondendo pelo WhatsApp.
Agora é ${momento.toFormat("cccc, dd/MM/yyyy, HH:mm")} (horário de Brasília).

Você anota no app, com as ferramentas: gastos e contas a pagar, pagamentos da equipe, compromissos (consultas, exames, reuniões) e tarefas. Também desfaz o último lançamento ou troca a categoria dele quando pedirem.

Cadastros da pessoa:
- Categorias: ${ouNenhum(nomesDasCategorias)}.
- Cartões de crédito: ${ouNenhum(nomesDosCartoes)}.
- Equipe (funcionários): ${ouNenhum(equipe)}.

Regras:
- Lance só o que a pessoa pediu, uma ferramenta por item. Se faltar algo essencial (o valor de um gasto, o dia ou a hora de um compromisso), pergunte em uma frase e não lance.
- Gasto sem data é de hoje e já pago. Conta "a pagar" ou "vence dia X" fica pendente, com o vencimento.
- Dia sem mês ou ano é o próximo a partir de hoje.
- Categoria: escolha a que mais combina, pelo nome exato. Guia (se a categoria existir): Alimentação = mercado, restaurante, almoço, lanche, padaria, delivery; Transporte = combustível, Uber, táxi, ônibus, estacionamento, pedágio, oficina; Saúde = farmácia, remédio, consulta, exame, plano de saúde; Casa = manutenção, reforma, móveis, utensílios, limpeza; Contas residenciais = luz, água, gás, condomínio, IPTU, aluguel; Contas fixas = internet, celular, assinaturas, streaming, escola, mensalidades; Lazer = cinema, show, passeio, bar, viagem. Se nenhuma servir, "Outros".
- Forma de pagamento (pix, débito, dinheiro, "crédito Itaú", "no cartão Nubank") nunca entra na descrição. Se foi no crédito de um cartão da lista, mande o nome dele em "cartao"; se a pessoa citou um cartão que não está na lista, a ferramenta avisa: pergunte se quer lançar sem o cartão.
- Pagamento a alguém da Equipe (o nome, às vezes com a função: "Maurício cuidador 3300") é sempre pagar_equipe, nunca lancar_conta.
- "Desfazer" junto com outra categoria ("desfazer, categoria almoço", "era alimentação") é trocar_categoria_ultimo. Se a ferramenta disser que a categoria não existe, pergunte se a pessoa quer criá-la; se ela disser que sim, use criar_categoria e depois trocar_categoria_ultimo.
- Quando uma ferramenta responder que aguarda confirmação, nada foi lançado: repita a pergunta dela, igual, e não diga que lançou.
- Se uma ferramenta devolver erro, explique o problema à pessoa em uma frase ou pergunte o que falta.
- Depois de lançar, confirme em uma linha o que ficou anotado e diga que dá para mandar "desfazer".
- Para qualquer outra coisa, responda curto dizendo o que você sabe fazer. Não invente lançamentos nem informações do app.
- Escreva em português do Brasil, curto, sem títulos nem listas longas; para destacar, use *assim*.`;
}

// ——— As ferramentas ———

const mensagemDoErro = (erro) =>
  erro instanceof ZodError ? erro.issues.map((i) => i.message).join(' ') : (erro.message ?? 'Erro desconhecido.');

// `dados` guarda o que o desfazer e a troca de categoria precisam (a entrada da ferramenta etc.).
async function registrar(usuarioId, tipo, recursoId, resumo, dados = null) {
  await db('whatsappLancamento').insert({ usuarioId, tipo, recursoId, resumo, dados });
  return resumo;
}

const mesmoNome = (a, b) => normalizar(a) === normalizar(b);

async function categoriaPeloNome(usuarioId, nome) {
  const lista = await categorias.listar(usuarioId);
  const achada = lista.find((c) => mesmoNome(c.nome, nome)) ?? lista.find((c) => mesmoNome(c.nome, 'Outros'));
  // Quem apagou "Outros" ganha de novo: o que não se encaixa precisa de um lugar.
  return achada ?? categorias.criar(usuarioId, { nome: 'Outros' });
}

// "Itaú" acha o cartão "Itaú" e também o "Itaú Platinum"; dois que servem viram pergunta.
async function cartaoPeloNome(usuarioId, nome) {
  const lista = await db('cartao').where({ usuarioId }).orderBy('ordem').select('id', 'nome');
  const procurado = normalizar(nome);
  const iguais = lista.filter((c) => normalizar(c.nome) === procurado);
  const parecidos = iguais.length ? iguais : lista.filter((c) => normalizar(c.nome).includes(procurado));
  if (parecidos.length === 1) return parecidos[0];
  const nomes = lista.map((c) => c.nome).join(', ') || 'nenhum';
  if (parecidos.length > 1) throw requisicaoInvalida(`Há mais de um cartão com "${nome}": ${nomes}. Pergunte qual foi.`);
  throw requisicaoInvalida(`Não há cartão "${nome}" cadastrado (cartões: ${nomes}). Nada foi lançado.`);
}

/**
 * Valor acima do limite não é lançado na hora: fica em whatsapp_pendente esperando o "SIM"
 * (tratado por `confirmar`, sem passar pelo Claude). Devolve o texto para a ferramenta.
 */
async function aguardarConfirmacao(usuarioId, ferramenta, entrada, valorCentavos, para) {
  const pergunta = `Confirma *${emReais(valorCentavos)}* para *${para}*? Responda *SIM* para lançar.`;
  await db('whatsappPendente').insert({ usuarioId, ferramenta, entrada, pergunta });
  return `Aguardando confirmação, nada foi lançado. Pergunte à pessoa exatamente: ${pergunta}`;
}

const passaDoLimite = (valorCentavos) => valorCentavos > env.WHATSAPP_CONFIRMAR_ACIMA_CENTAVOS;

async function lancarConta(usuarioId, entrada, { confirmado = false } = {}) {
  if (!confirmado && passaDoLimite(entrada.valor_centavos)) {
    return aguardarConfirmacao(usuarioId, 'lancar_conta', entrada, entrada.valor_centavos, entrada.descricao);
  }
  const categoria = await categoriaPeloNome(usuarioId, entrada.categoria);
  if (entrada.cartao) return lancarNoCartao(usuarioId, entrada, categoria);

  const pago = entrada.situacao === 'pago';
  const dados = esquemaPagamento.criacao.parse({
    descricao: entrada.descricao,
    categoriaId: categoria.id,
    valorCentavos: entrada.valor_centavos,
    vencimento: entrada.data,
    status: entrada.situacao,
    dataPagamento: pago ? entrada.data : null,
    observacoes: 'Lançado pelo WhatsApp.',
  });
  const conta = await pagamentos.criar(usuarioId, dados);
  const valor = emReais(conta.valorCentavos);
  const quando = pago ? `pago em ${diaCurto(conta.vencimento)}` : `vence em ${diaCurto(conta.vencimento)}`;
  const resumo = `${conta.descricao}, ${valor}, ${quando}, em ${categoria.nome}`;
  return registrar(usuarioId, 'pagamento', conta.id, resumo, { entrada });
}

// A compra entra na fatura do cartão (que vira conta em Despesas), como pelo app.
async function lancarNoCartao(usuarioId, entrada, categoria) {
  const cartao = await cartaoPeloNome(usuarioId, entrada.cartao);
  const dados = esquemaCartao.corpoCompra.parse({
    descricao: entrada.descricao,
    valorTotalCentavos: entrada.valor_centavos,
    parcelas: entrada.parcelas ?? 1,
    dataCompra: entrada.data,
    categoriaId: categoria.id,
    observacoes: 'Lançado pelo WhatsApp.',
  });
  const compra = await cartoes.criarCompra(usuarioId, cartao.id, dados);
  const parcelas = compra.parcelas > 1 ? ` em ${compra.parcelas}x` : '';
  const resumo = `${compra.descricao}, ${emReais(compra.valorTotalCentavos)}${parcelas} no cartão ${cartao.nome}, em ${diaCurto(compra.dataCompra)}, em ${categoria.nome}`;
  return registrar(usuarioId, 'compra_cartao', compra.id, resumo, { entrada, cartaoId: cartao.id });
}

// Acha pelo nome inteiro ou por parte dele ("Maurício" acha "Maurício Souza").
async function membroPeloNome(usuarioId, nome) {
  const lista = await db('membroEquipe').where({ usuarioId, ativo: true }).orderBy('nome').select('id', 'nome');
  const palavras = normalizar(nome).split(' ');
  const iguais = lista.filter((m) => mesmoNome(m.nome, nome));
  const parecidos = iguais.length
    ? iguais
    : lista.filter((m) => palavras.every((p) => normalizar(m.nome).split(' ').includes(p)));
  if (parecidos.length === 1) return parecidos[0];
  if (parecidos.length > 1) {
    throw requisicaoInvalida(`Há mais de uma pessoa com "${nome}" na Equipe: ${parecidos.map((m) => m.nome).join(', ')}. Pergunte qual.`);
  }
  throw requisicaoInvalida(`Não há "${nome}" na Equipe. Pergunte se é um gasto comum (lancar_conta).`);
}

async function pagarEquipe(usuarioId, entrada, { confirmado = false } = {}) {
  const membro = await membroPeloNome(usuarioId, entrada.nome);
  // As contas da equipe nascem pela manutenção; aqui garante as do mês antes de procurar.
  await garantirContas(db, usuarioId);
  const conta = await db('pagamento')
    .where({ usuarioId, membroId: membro.id, status: 'pendente' })
    .orderBy('vencimento')
    .first('id', 'valorCentavos', 'vencimento');
  if (!conta) throw requisicaoInvalida(`${membro.nome} não tem conta a pagar. Os dias de pagamento ficam em Salários equipe, no app.`);

  const valor = entrada.valor_centavos ?? conta.valorCentavos;
  if (valor === null) throw requisicaoInvalida(`O valor de ${membro.nome} está a definir. Pergunte quanto foi pago.`);
  if (!confirmado && passaDoLimite(valor)) {
    return aguardarConfirmacao(usuarioId, 'pagar_equipe', entrada, valor, membro.nome);
  }
  const paga = await pagamentos.pagar(usuarioId, conta.id, { dataPagamento: entrada.data, valorCentavos: valor });
  const resumo = `${membro.nome}, ${emReais(paga.valorCentavos)}, pago em ${diaCurto(paga.dataPagamento)} (conta de ${diaCurto(paga.vencimento)}, em Salários equipe)`;
  return registrar(usuarioId, 'pagamento_equipe', paga.id, resumo, { valorAnterior: conta.valorCentavos });
}

async function criarCompromisso(usuarioId, entrada) {
  const dados = esquemaEvento.corpo.parse({
    titulo: entrada.titulo,
    tipo: entrada.tipo,
    tipoDescricao: entrada.tipo === 'outro' ? entrada.titulo : null,
    inicio: entrada.inicio,
    local: entrada.local,
    observacoes: 'Lançado pelo WhatsApp.',
    lembretesMinutosAntes: [entrada.lembrete_minutos_antes ?? 60],
  });
  const evento = await eventos.criar(usuarioId, dados);
  const inicio = DateTime.fromISO(evento.inicio, { zone: FUSO });
  return registrar(usuarioId, 'evento', evento.id, `${evento.titulo}, ${inicio.toFormat("dd/MM 'às' HH:mm")}`);
}

async function criarTarefa(usuarioId, entrada) {
  const dados = esquemaTarefa.corpo.parse({
    titulo: entrada.titulo,
    data: entrada.data,
    hora: entrada.hora,
    lembrete: Boolean(entrada.hora),
  });
  const tarefa = await tarefas.criar(usuarioId, dados);
  const hora = tarefa.hora ? ` às ${tarefa.hora}` : '';
  return registrar(usuarioId, 'tarefa', tarefa.id, `${tarefa.titulo}, ${diaCurto(tarefa.data)}${hora}`);
}

async function criarCategoria(usuarioId, entrada) {
  const { nome } = esquemaCategoria.corpoCriar.parse({ nome: entrada.nome });
  const existente = (await categorias.listar(usuarioId)).find((c) => mesmoNome(c.nome, nome));
  if (existente) return `A categoria ${existente.nome} já existe.`;
  const criada = await categorias.criar(usuarioId, { nome });
  return `Categoria ${criada.nome} criada.`;
}

const REMOVER = {
  pagamento: (usuarioId, l) => pagamentos.remover(usuarioId, l.recursoId),
  evento: (usuarioId, l) => eventos.remover(usuarioId, l.recursoId),
  tarefa: (usuarioId, l) => tarefas.remover(usuarioId, l.recursoId),
  compra_cartao: (usuarioId, l) => cartoes.removerCompra(usuarioId, l.dados.cartaoId, l.recursoId),
  // A conta da equipe não é apagada: volta a pendente, com o valor que tinha (pode ser "a definir").
  pagamento_equipe: async (usuarioId, l) => {
    await pagamentos.desfazerPagamento(usuarioId, l.recursoId);
    await db('pagamento')
      .where({ id: l.recursoId, usuarioId, status: 'pendente' })
      .update({ valorCentavos: l.dados.valorAnterior });
  },
};

const ultimoLancamento = (usuarioId, agora) =>
  db('whatsappLancamento')
    .where({ usuarioId })
    .whereNull('desfeitoEm')
    .where('criadoEm', '>', new Date(agora - DESFAZER_MS))
    .orderBy('criadoEm', 'desc')
    .first('id', 'tipo', 'recursoId', 'resumo', 'dados');

async function desfazer(usuarioId, lancamento, agora) {
  try {
    await REMOVER[lancamento.tipo](usuarioId, lancamento);
  } catch (erro) {
    // Já apagado pelo app: o desfazer só marca.
    if (erro.status !== 404) throw erro;
  }
  await db('whatsappLancamento').where({ id: lancamento.id }).update({ desfeitoEm: new Date(agora) });
}

/** Apaga o último lançamento das últimas 24 h que ainda não foi desfeito. Devolve o texto para a pessoa. */
async function desfazerUltimo(usuarioId, agora = Date.now()) {
  const ultimo = await ultimoLancamento(usuarioId, agora);
  if (!ultimo) return TEXTOS.nadaParaDesfazer;
  await desfazer(usuarioId, ultimo, agora);
  return `Desfeito: ${ultimo.resumo}.`;
}

// Desfaz o último gasto e lança de novo com a mesma entrada, só trocando a categoria. A categoria
// precisa existir (sem cair em "Outros"): senão o Claude pergunta se a pessoa quer criar.
async function trocarCategoriaUltimo(usuarioId, entrada, { agora = Date.now() } = {}) {
  const ultimo = await ultimoLancamento(usuarioId, agora);
  if (!ultimo) return TEXTOS.nadaParaDesfazer;
  if (!['pagamento', 'compra_cartao'].includes(ultimo.tipo) || !ultimo.dados?.entrada) {
    throw requisicaoInvalida(`O último lançamento (${ultimo.resumo}) não tem categoria para trocar.`);
  }
  const lista = await categorias.listar(usuarioId);
  const categoria = lista.find((c) => mesmoNome(c.nome, entrada.categoria));
  if (!categoria) {
    throw requisicaoInvalida(
      `A categoria "${entrada.categoria}" não existe (categorias: ${lista.map((c) => c.nome).join(', ')}). Nada foi mudado. Pergunte se a pessoa quer criá-la.`,
    );
  }
  await desfazer(usuarioId, ultimo, agora);
  // Já passou pela confirmação (se precisou) quando foi lançado.
  const novo = await lancarConta(usuarioId, { ...ultimo.dados.entrada, categoria: categoria.nome }, { confirmado: true });
  return `Trocado: ${novo} (antes: ${ultimo.resumo}).`;
}

const EXECUTAR = {
  lancar_conta: lancarConta,
  pagar_equipe: pagarEquipe,
  criar_compromisso: criarCompromisso,
  criar_tarefa: criarTarefa,
  criar_categoria: criarCategoria,
  trocar_categoria_ultimo: trocarCategoriaUltimo,
  desfazer_ultimo: (usuarioId, _, { agora }) => desfazerUltimo(usuarioId, agora),
};

async function executar(usuarioId, bloco, agora) {
  const funcao = EXECUTAR[bloco.name];
  try {
    if (!funcao) throw new Error(`Ferramenta desconhecida: ${bloco.name}`);
    return { type: 'tool_result', tool_use_id: bloco.id, content: await funcao(usuarioId, bloco.input, { agora }) };
  } catch (erro) {
    // Erro de validação ou de regra (AppError) volta para o Claude explicar ou perguntar.
    if (!(erro instanceof ZodError) && !erro.status) throw erro;
    return { type: 'tool_result', tool_use_id: bloco.id, content: mensagemDoErro(erro), is_error: true };
  }
}

// ——— Confirmação ("SIM" / "NÃO") ———

const pendentes = (usuarioId, agora) =>
  db('whatsappPendente')
    .where({ usuarioId })
    .where('criadoEm', '>', new Date(agora - CONFIRMAR_MS))
    .orderBy('criadoEm')
    .select('id', 'ferramenta', 'entrada');

const descartarPendentes = (usuarioId) => db('whatsappPendente').where({ usuarioId }).del();

/**
 * "SIM": lança o que esperava confirmação. Devolve o texto para a pessoa, ou null se não havia nada
 * esperando (aí a mensagem segue para o Claude).
 */
async function confirmar(usuarioId, agora = Date.now()) {
  const lista = await pendentes(usuarioId, agora);
  await descartarPendentes(usuarioId);
  if (!lista.length) return null;
  const feitos = [];
  for (const p of lista) {
    try {
      feitos.push(await EXECUTAR[p.ferramenta](usuarioId, p.entrada, { confirmado: true, agora }));
    } catch (erro) {
      if (!(erro instanceof ZodError) && !erro.status) throw erro;
      feitos.push(`não deu para lançar: ${mensagemDoErro(erro)}`);
    }
  }
  return `Pronto: ${feitos.join('; ')}. Se errei, mande "desfazer".`;
}

/** "NÃO": descarta o que esperava confirmação; null se não havia nada. */
async function recusar(usuarioId, agora = Date.now()) {
  const lista = await pendentes(usuarioId, agora);
  await descartarPendentes(usuarioId);
  return lista.length ? TEXTOS.naoLancado : null;
}

// ——— Conversa ———

async function historico(usuarioId, agora) {
  const falas = await db('whatsappConversa')
    .where({ usuarioId })
    .where('criadoEm', '>', new Date(agora - HISTORICO_MS))
    .orderBy('criadoEm', 'desc')
    .limit(HISTORICO_FALAS)
    .select('papel', 'texto');
  const mensagens = falas.reverse().map((f) => ({ role: f.papel === 'usuario' ? 'user' : 'assistant', content: f.texto }));
  // A API exige começar pelo usuário.
  while (mensagens[0]?.role === 'assistant') mensagens.shift();
  return mensagens;
}

const guardar = (usuarioId, papel, texto) => db('whatsappConversa').insert({ usuarioId, papel, texto });

const textoDa = (resposta) =>
  resposta.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

/**
 * Responde à mensagem de texto de quem ligou o número: o Claude lança o que for pedido e devolve
 * a resposta para mandar. `agora` em ms (os testes fixam).
 */
async function cadastros(usuarioId) {
  const [listaCategorias, listaCartoes, listaEquipe] = await Promise.all([
    categorias.listar(usuarioId),
    db('cartao').where({ usuarioId }).orderBy('ordem').pluck('nome'),
    db('membroEquipe').where({ usuarioId, ativo: true }).orderBy('nome').select('nome', 'funcao'),
  ]);
  return {
    categorias: listaCategorias.map((c) => c.nome),
    cartoes: listaCartoes,
    equipe: listaEquipe.map((m) => (m.funcao ? `${m.nome} (${m.funcao})` : m.nome)),
  };
}

async function responder(usuario, texto, agora = Date.now()) {
  // Qualquer outra mensagem que não o "SIM" deixa de confirmar o que esperava.
  await descartarPendentes(usuario.id);
  const contexto = await cadastros(usuario.id);
  const mensagens = [...(await historico(usuario.id, agora)), { role: 'user', content: texto }];
  await guardar(usuario.id, 'usuario', texto);

  let resposta;
  for (let volta = 0; volta < MAX_VOLTAS; volta += 1) {
    resposta = await claude.criarMensagem({
      model: MODELO,
      max_tokens: 4096,
      output_config: { effort: 'medium' },
      system: sistema(usuario, contexto, agora),
      tools: FERRAMENTAS,
      messages: mensagens,
    });
    if (resposta.stop_reason !== 'tool_use') break;

    // Os blocos voltam inteiros (inclusive thinking), como a API pede.
    mensagens.push({ role: 'assistant', content: resposta.content });
    const pedidos = resposta.content.filter((b) => b.type === 'tool_use');
    const resultados = [];
    for (const pedido of pedidos) resultados.push(await executar(usuario.id, pedido, agora));
    mensagens.push({ role: 'user', content: resultados });
  }

  let final = resposta.stop_reason === 'refusal' ? TEXTOS.recusou : textoDa(resposta) || TEXTOS.falhou;
  // A pergunta de confirmação sai sempre, mesmo que o Claude a tenha esquecido ou reescrito.
  const perguntas = await db('whatsappPendente').where({ usuarioId: usuario.id }).orderBy('criadoEm').pluck('pergunta');
  const faltando = perguntas.filter((p) => !final.includes(p));
  if (faltando.length) final = [final, ...faltando].join('\n\n');
  await guardar(usuario.id, 'assistente', final);
  return final;
}

/** Responde ao "SIM"/"NÃO" sem o Claude; null se nada esperava confirmação. Fica no histórico. */
async function responderConfirmacao(usuario, texto, sim, agora = Date.now()) {
  const final = await (sim ? confirmar : recusar)(usuario.id, agora);
  if (final) {
    await guardar(usuario.id, 'usuario', texto);
    await guardar(usuario.id, 'assistente', final);
  }
  return final;
}

/** Apaga as falas de mais de 1 dia e os lançamentos de mais de 30 (manutenção). */
async function limparAntigos(conexao = db) {
  await conexao('whatsappConversa').where('criadoEm', '<', conexao.raw("now() - interval '1 day'")).del();
  await conexao('whatsappLancamento').where('criadoEm', '<', conexao.raw("now() - interval '30 days'")).del();
  await conexao('whatsappPendente').where('criadoEm', '<', conexao.raw("now() - interval '1 day'")).del();
}

module.exports = { responder, responderConfirmacao, desfazerUltimo, descartarPendentes, limparAntigos, FERRAMENTAS, MODELO, TEXTOS };
