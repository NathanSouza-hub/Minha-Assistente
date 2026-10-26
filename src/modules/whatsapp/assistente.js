// Assistente do WhatsApp, fase 2 (decisão 38): o Claude Haiku entende a mensagem de quem ligou o
// número ("almoço 45,90", "dentista dia 18 às 15h") e lança no app chamando os services dos módulos
// por tool use. Cada ferramenta valida com o mesmo esquema Zod das rotas, então o que entra por aqui
// obedece às mesmas regras do app. O que foi lançado fica em whatsapp_lancamento para o "desfazer".
const { ZodError } = require('zod');
const db = require('../../config/db');
const claude = require('../../lib/claude');
const { FUSO } = require('../../lib/tempo');
const { DateTime } = require('luxon');
const pagamentos = require('../pagamentos/service');
const esquemaPagamento = require('../pagamentos/schema');
const eventos = require('../eventos/service');
const esquemaEvento = require('../eventos/schema');
const tarefas = require('../tarefas/service');
const esquemaTarefa = require('../tarefas/schema');
const categorias = require('../categorias/service');

const MODELO = 'claude-haiku-5-5';
// Voltas do laço de ferramentas por mensagem (cada volta é uma chamada à API).
const MAX_VOLTAS = 5;
// A conversa que o Claude vê: as últimas falas da última meia hora.
const HISTORICO_FALAS = 10;
const HISTORICO_MS = 30 * 60_000;
// "Desfazer" só alcança o que foi lançado nas últimas 24 h.
const DESFAZER_MS = 24 * 60 * 60_000;

const TEXTOS = {
  falhou: 'Não consegui entender agora. Tente de novo em instantes ou lance pelo app.',
  recusou: 'Não posso ajudar com isso por aqui. Posso anotar contas, compromissos e tarefas.',
  nadaParaDesfazer: 'Não achei nada lançado por aqui nas últimas 24 horas para desfazer.',
};

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const diaCurto = (iso) => DateTime.fromISO(iso, { zone: FUSO }).toFormat('dd/MM');

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
      required: ['descricao', 'valor_centavos', 'data', 'situacao', 'categoria'],
      properties: {
        descricao: { type: 'string', description: 'Do que é, curto, como a pessoa escreveu ("Almoço na praia").' },
        valor_centavos: { type: 'integer', description: 'Valor em centavos: "45,90" = 4590; "1.200" = 120000.' },
        data: { type: 'string', format: 'date', description: 'pago: dia do pagamento; pendente: vencimento. AAAA-MM-DD.' },
        situacao: { type: 'string', enum: ['pago', 'pendente'] },
        categoria: { type: 'string', description: 'Nome exato de uma das categorias da pessoa; "Outros" se nenhuma servir.' },
      },
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

function sistema(usuario, nomesDasCategorias, agora) {
  const momento = DateTime.fromMillis(agora, { zone: FUSO }).setLocale('pt-BR');
  return `Você é a Minha Assistente, secretária pessoal de ${usuario.nome}, respondendo pelo WhatsApp.
Agora é ${momento.toFormat("cccc, dd/MM/yyyy, HH:mm")} (horário de Brasília).

Você anota no app, com as ferramentas: gastos e contas a pagar, compromissos (consultas, exames, reuniões) e tarefas. Também desfaz o último lançamento quando pedirem.

Regras:
- Lance só o que a pessoa pediu, uma ferramenta por item. Se faltar algo essencial (o valor de um gasto, o dia ou a hora de um compromisso), pergunte em uma frase e não lance.
- Gasto sem data é de hoje e já pago. Conta "a pagar" ou "vence dia X" fica pendente, com o vencimento.
- Dia sem mês ou ano é o próximo a partir de hoje.
- Categorias da pessoa: ${nomesDasCategorias.join(', ')}. Use o nome exato de uma delas; se nenhuma servir, "Outros".
- Se uma ferramenta devolver erro, explique o problema à pessoa em uma frase ou pergunte o que falta.
- Depois de lançar, confirme em uma linha o que ficou anotado e diga que dá para mandar "desfazer".
- Para qualquer outra coisa, responda curto dizendo o que você sabe fazer. Não invente lançamentos nem informações do app.
- Escreva em português do Brasil, curto, sem títulos nem listas longas; para destacar, use *assim*.`;
}

// ——— As ferramentas ———

const mensagemDoErro = (erro) =>
  erro instanceof ZodError ? erro.issues.map((i) => i.message).join(' ') : (erro.message ?? 'Erro desconhecido.');

async function registrar(usuarioId, tipo, recursoId, resumo) {
  await db('whatsappLancamento').insert({ usuarioId, tipo, recursoId, resumo });
  return resumo;
}

async function categoriaPeloNome(usuarioId, nome) {
  const lista = await categorias.listar(usuarioId);
  const igual = (c, n) => c.nome.localeCompare(n, 'pt-BR', { sensitivity: 'base' }) === 0;
  const achada = lista.find((c) => igual(c, nome)) ?? lista.find((c) => igual(c, 'Outros'));
  // Quem apagou "Outros" ganha de novo: o que não se encaixa precisa de um lugar.
  return achada ?? categorias.criar(usuarioId, { nome: 'Outros' });
}

async function lancarConta(usuarioId, entrada) {
  const categoria = await categoriaPeloNome(usuarioId, entrada.categoria);
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
  const valor = reais.format(conta.valorCentavos / 100);
  const quando = pago ? `pago em ${diaCurto(conta.vencimento)}` : `vence em ${diaCurto(conta.vencimento)}`;
  return registrar(usuarioId, 'pagamento', conta.id, `${conta.descricao}, ${valor}, ${quando}, em ${categoria.nome}`);
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

const REMOVER = { pagamento: pagamentos.remover, evento: eventos.remover, tarefa: tarefas.remover };

/** Apaga o último lançamento das últimas 24 h que ainda não foi desfeito. Devolve o texto para a pessoa. */
async function desfazerUltimo(usuarioId, agora = Date.now()) {
  const ultimo = await db('whatsappLancamento')
    .where({ usuarioId })
    .whereNull('desfeitoEm')
    .where('criadoEm', '>', new Date(agora - DESFAZER_MS))
    .orderBy('criadoEm', 'desc')
    .first('id', 'tipo', 'recursoId', 'resumo');
  if (!ultimo) return TEXTOS.nadaParaDesfazer;
  try {
    await REMOVER[ultimo.tipo](usuarioId, ultimo.recursoId);
  } catch (erro) {
    // Já apagado pelo app: o desfazer só marca.
    if (erro.status !== 404) throw erro;
  }
  await db('whatsappLancamento').where({ id: ultimo.id }).update({ desfeitoEm: new Date(agora) });
  return `Desfeito: ${ultimo.resumo}.`;
}

const EXECUTAR = {
  lancar_conta: lancarConta,
  criar_compromisso: criarCompromisso,
  criar_tarefa: criarTarefa,
  desfazer_ultimo: (usuarioId) => desfazerUltimo(usuarioId),
};

async function executar(usuarioId, bloco) {
  const funcao = EXECUTAR[bloco.name];
  try {
    if (!funcao) throw new Error(`Ferramenta desconhecida: ${bloco.name}`);
    return { type: 'tool_result', tool_use_id: bloco.id, content: await funcao(usuarioId, bloco.input) };
  } catch (erro) {
    // Erro de validação ou de regra (AppError) volta para o Claude explicar ou perguntar.
    if (!(erro instanceof ZodError) && !erro.status) throw erro;
    return { type: 'tool_result', tool_use_id: bloco.id, content: mensagemDoErro(erro), is_error: true };
  }
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
async function responder(usuario, texto, agora = Date.now()) {
  const nomes = (await categorias.listar(usuario.id)).map((c) => c.nome);
  const mensagens = [...(await historico(usuario.id, agora)), { role: 'user', content: texto }];
  await guardar(usuario.id, 'usuario', texto);

  let resposta;
  for (let volta = 0; volta < MAX_VOLTAS; volta += 1) {
    resposta = await claude.criarMensagem({
      model: MODELO,
      max_tokens: 4096,
      output_config: { effort: 'medium' },
      system: sistema(usuario, nomes, agora),
      tools: FERRAMENTAS,
      messages: mensagens,
    });
    if (resposta.stop_reason !== 'tool_use') break;

    // Os blocos voltam inteiros (inclusive thinking), como a API pede.
    mensagens.push({ role: 'assistant', content: resposta.content });
    const pedidos = resposta.content.filter((b) => b.type === 'tool_use');
    const resultados = [];
    for (const pedido of pedidos) resultados.push(await executar(usuario.id, pedido));
    mensagens.push({ role: 'user', content: resultados });
  }

  const final =
    resposta.stop_reason === 'refusal' ? TEXTOS.recusou : textoDa(resposta) || TEXTOS.falhou;
  await guardar(usuario.id, 'assistente', final);
  return final;
}

/** Apaga as falas de mais de 1 dia e os lançamentos de mais de 30 (manutenção). */
async function limparAntigos(conexao = db) {
  await conexao('whatsappConversa').where('criadoEm', '<', conexao.raw("now() - interval '1 day'")).del();
  await conexao('whatsappLancamento').where('criadoEm', '<', conexao.raw("now() - interval '30 days'")).del();
}

module.exports = { responder, desfazerUltimo, limparAntigos, FERRAMENTAS, MODELO, TEXTOS };
