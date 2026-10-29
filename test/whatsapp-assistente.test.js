require('./setup');
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const claude = require('../src/lib/claude');
const whatsapp = require('../src/lib/whatsapp');
const { criarApp } = require('../src/app');
const entrada = require('../src/modules/whatsapp/entrada');
const assistente = require('../src/modules/whatsapp/assistente');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;
let ana;
const TELEFONE = '5511987654321';

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app, { nome: 'Ana' });
  await db('whatsappVinculo').insert({ usuarioId: ana.usuario.id, telefone: TELEFONE, vinculadoEm: new Date() });
});

after(async () => {
  await db.destroy();
});

let contador = 0;
function corpo(mensagem, de = TELEFONE) {
  contador += 1;
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: process.env.WHATSAPP_NUMERO_ID },
              messages: [{ from: de, id: `wamid.assistente.${contador}`, timestamp: '1761480000', ...mensagem }],
            },
          },
        ],
      },
    ],
  };
}
const texto = (body, de) => corpo({ type: 'text', text: { body } }, de);

// Respostas da API do Claude como a SDK devolve.
const usarFerramenta = (name, input, id = `toolu_${name}`) => ({
  stop_reason: 'tool_use',
  content: [{ type: 'thinking', thinking: '', signature: 'assinatura' }, { type: 'tool_use', id, name, input }],
});
const responderTexto = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });

/**
 * Liga o assistente com um Claude de roteiro (uma resposta por chamada) e processa o corpo como o
 * webhook. Devolve as chamadas ao Claude (cópia dos parâmetros) e as mensagens que teriam saído.
 * Os mocks valem só durante a chamada.
 */
async function conversar(corpoDaMensagem, roteiro = [], { controle = entrada.criarControle(), agora = Date.now() } = {}) {
  const chamadas = [];
  const enviadas = [];
  mock.method(claude, 'ativo', () => true);
  mock.method(claude, 'criarMensagem', async (parametros) => {
    chamadas.push(structuredClone(parametros));
    const proxima = roteiro.shift();
    if (!proxima) throw new Error('Roteiro do Claude acabou');
    if (proxima instanceof Error) throw proxima;
    return proxima;
  });
  mock.method(whatsapp, 'enviarTexto', async (_, mensagem) => {
    enviadas.push(mensagem);
    return {};
  });
  try {
    await entrada.processar(corpoDaMensagem, controle, agora);
  } finally {
    mock.restoreAll();
  }
  return { chamadas, enviadas };
}

const hojeISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

test('"almoço 45,90" vira conta paga em Outros, e o Claude confirma', async () => {
  const { chamadas, enviadas } = await conversar(texto('almoço 45,90'), [
    usarFerramenta('lancar_conta', {
      descricao: 'Almoço',
      valor_centavos: 4590,
      data: hojeISO(),
      situacao: 'pago',
      categoria: 'outros',
    }),
    responderTexto('Anotei *Almoço*, R$ 45,90, pago hoje em Outros. Mande "desfazer" se errei.'),
  ]);

  assert.deepEqual(enviadas, ['Anotei *Almoço*, R$ 45,90, pago hoje em Outros. Mande "desfazer" se errei.']);
  const [primeira, segunda] = chamadas;
  assert.equal(primeira.model, 'claude-haiku-5-5');
  assert.match(primeira.system, /secretária pessoal de Ana/);
  assert.match(primeira.system, /Categorias: Contas residenciais, Alimentação, Transporte, Saúde, Casa, Contas fixas, Lazer, Outros\./);
  assert.deepEqual(primeira.messages, [{ role: 'user', content: 'almoço 45,90' }]);
  assert.ok(primeira.tools.every((f) => f.strict));

  // A volta seguinte leva o pedido inteiro (com o thinking) e o resultado da ferramenta.
  assert.equal(segunda.messages[1].content[0].type, 'thinking');
  const [resultado] = segunda.messages[2].content;
  assert.equal(resultado.tool_use_id, 'toolu_lancar_conta');
  assert.equal(resultado.is_error, undefined);
  assert.match(resultado.content, /Almoço, R\$\s45,90, pago em \d\d\/\d\d, em Outros/);

  const conta = await db('pagamento')
    .join('categoriaPagamento as c', 'c.id', 'pagamento.categoriaId')
    .where('pagamento.usuarioId', ana.usuario.id)
    .first('pagamento.descricao', 'pagamento.valorCentavos', 'pagamento.status', 'pagamento.dataPagamento', 'c.nome');
  assert.deepEqual(conta, { descricao: 'Almoço', valorCentavos: 4590, status: 'pago', dataPagamento: hojeISO(), nome: 'Outros' });
});

test('"desfazer" apaga o último lançamento sem chamar o Claude; de novo, não há o que desfazer', async () => {
  const { chamadas, enviadas } = await conversar(texto('Desfazer'));
  assert.equal(chamadas.length, 0);
  assert.match(enviadas[0], /^Desfeito: Almoço, R\$\s45,90/);
  assert.equal(await db('pagamento').where({ usuarioId: ana.usuario.id }).first(), undefined);

  const outra = await conversar(texto('desfaz'));
  assert.deepEqual(outra.enviadas, [assistente.TEXTOS.nadaParaDesfazer]);
});

test('compromisso ganha aviso 1 h antes; tarefa com hora ganha lembrete', async () => {
  const { enviadas } = await conversar(texto('dentista dia 18/12 às 15h e ligar pro banco amanhã 9h'), [
    {
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'criar_compromisso',
          input: { titulo: 'Dentista', inicio: '2026-12-18T15:00:00-03:00', tipo: 'consulta', local: null, lembrete_minutos_antes: null },
        },
        { type: 'tool_use', id: 'toolu_2', name: 'criar_tarefa', input: { titulo: 'Ligar para o banco', data: '2026-12-17', hora: '09:00' } },
      ],
    },
    responderTexto('Pronto: dentista em 18/12 às 15:00 e tarefa para 17/12 às 09:00.'),
  ]);
  assert.equal(enviadas.length, 1);

  const evento = await db('evento').where({ usuarioId: ana.usuario.id }).first('titulo', 'tipo', 'inicio', 'lembretesMinutosAntes');
  assert.deepEqual(evento, { titulo: 'Dentista', tipo: 'consulta', inicio: '2026-12-18T15:00:00-03:00', lembretesMinutosAntes: [60] });
  const tarefa = await db('tarefa').where({ usuarioId: ana.usuario.id }).first('titulo', 'data', 'hora', 'lembrete');
  assert.deepEqual(tarefa, { titulo: 'Ligar para o banco', data: '2026-12-17', hora: '09:00', lembrete: true });

  // Desfazer tira só o último (a tarefa).
  await conversar(texto('desfazer'));
  assert.equal(await db('tarefa').where({ usuarioId: ana.usuario.id }).first(), undefined);
  assert.ok(await db('evento').where({ usuarioId: ana.usuario.id }).first());
});

test('dado inválido volta como erro da ferramenta para o Claude perguntar; nada é lançado', async () => {
  const { chamadas, enviadas } = await conversar(texto('mercado'), [
    usarFerramenta('lancar_conta', { descricao: 'Mercado', valor_centavos: 0, data: hojeISO(), situacao: 'pago', categoria: 'Outros' }),
    responderTexto('Qual foi o valor do mercado?'),
  ]);
  const [resultado] = chamadas[1].messages.at(-1).content;
  assert.equal(resultado.is_error, true);
  assert.match(resultado.content, /maior que zero/);
  assert.deepEqual(enviadas, ['Qual foi o valor do mercado?']);
  assert.equal(await db('pagamento').where({ usuarioId: ana.usuario.id, descricao: 'Mercado' }).first(), undefined);
});

test('a resposta seguinte vê a conversa recente (a pergunta e a resposta anteriores)', async () => {
  const agora = Date.now();
  const { chamadas } = await conversar(texto('120'), [responderTexto('Anotado.')], { agora: agora + 60_000 });
  // A fala anterior ("mercado" → "Qual foi o valor do mercado?") veio junto.
  const ultimas = chamadas[0].messages.slice(-3);
  assert.deepEqual(ultimas, [
    { role: 'user', content: 'mercado' },
    { role: 'assistant', content: 'Qual foi o valor do mercado?' },
    { role: 'user', content: '120' },
  ]);
});

test('falha da API e recusa viram respostas curtas', async () => {
  const falha = await conversar(texto('oi'), [new Error('rede caiu')]);
  assert.deepEqual(falha.enviadas, [assistente.TEXTOS.falhou]);

  const recusa = await conversar(texto('oi de novo'), [{ stop_reason: 'refusal', content: [] }]);
  assert.deepEqual(recusa.enviadas, [assistente.TEXTOS.recusou]);
});

test('foto, texto longo e excesso de mensagens não chegam ao Claude', async () => {
  const controle = entrada.criarControle();
  const agora = Date.now();
  const foto = await conversar(corpo({ type: 'image', image: { id: 'midia' } }), [], { controle, agora });
  assert.deepEqual(foto.enviadas, [entrada.TEXTOS.soTexto]);

  const longa = await conversar(texto('a'.repeat(1001)), [], { controle, agora });
  assert.deepEqual(longa.enviadas, [entrada.TEXTOS.longa]);

  // 40 por hora (a foto e a longa já contaram): a 41ª avisa, a 42ª fica sem resposta.
  const roteiro = Array.from({ length: 38 }, () => responderTexto('ok'));
  for (let i = 0; i < 38; i += 1) await conversar(texto(`oi ${i}`), roteiro, { controle, agora });
  assert.deepEqual((await conversar(texto('mais uma'), [], { controle, agora })).enviadas, [entrada.TEXTOS.limite]);
  assert.deepEqual((await conversar(texto('e outra'), [], { controle, agora })).enviadas, []);
});

test('sem a chave da Anthropic o número ligado recebe o aviso de antes', async (t) => {
  const enviadas = [];
  t.mock.method(whatsapp, 'enviarTexto', async (_, mensagem) => enviadas.push(mensagem));
  await entrada.processar(texto('almoço 30'), entrada.criarControle());
  assert.deepEqual(enviadas, [entrada.TEXTOS.emBreve('Ana')]);
});

test('mensagens do mesmo número são tratadas uma de cada vez', async () => {
  const controle = entrada.criarControle();
  const ordem = [];
  const devagar = (nome, ms) => () => new Promise((r) => setTimeout(() => r(ordem.push(nome)), ms));
  await Promise.all([
    controle.emFila('1', devagar('a', 30)),
    controle.emFila('1', devagar('b', 0)),
    controle.emFila('2', devagar('c', 0)),
  ]);
  assert.deepEqual(ordem, ['c', 'a', 'b']);
});
