require('./setup');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { DateTime } = require('luxon');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { FUSO } = require('../src/lib/tempo');
const { executarCiclo } = require('../src/lembretes/agendador');
const { textoDoResumo } = require('../src/lembretes/geradores/resumo');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

const em = (iso) => DateTime.fromISO(iso, { zone: FUSO });

let app;
let ana;
let enviados;
// Canal falso: só a Ana tem aparelho.
const canal = {
  nome: 'app',
  ativo: () => true,
  usuarios: (conexao) => conexao('usuario').where('id', ana.usuario.id).select('id'),
  enviar: async (_conexao, usuarioId, mensagem) => {
    enviados.push({ usuarioId, ...mensagem });
    return { entregue: true };
  },
};
const ciclo = (iso) => executarCiclo(em(iso), { canais: [canal] });
const resumos = () => enviados.filter((e) => e.tag.startsWith('resumo:'));
const pendentes = () =>
  db('lembreteEnvio')
    .where({ origemTipo: 'resumo', status: 'pendente' })
    .orderBy('agendadoPara')
    .select('agendadoPara')
    .then((linhas) => linhas.map((l) => l.agendadoPara));

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
});

beforeEach(() => {
  enviados = [];
});

after(async () => {
  await db.destroy();
});

test('texto do resumo: só o que há no dia; dia vazio não gera aviso', () => {
  const vazio = { eventos: [], medicamentos: [], rotina: [], pagamentos: { aVencer: [], vencidos: [] } };
  assert.equal(textoDoResumo({ data: '2027-01-12', ...vazio }), null);

  const cheio = textoDoResumo({
    data: '2027-01-12',
    eventos: [
      { titulo: 'Fisioterapia', inicio: '2027-01-12T09:00:00-03:00' },
      { titulo: 'Consulta', inicio: '2027-01-12T15:00:00-03:00' },
    ],
    medicamentos: [{ tomado: false }, { tomado: true }, { tomado: false }],
    rotina: [{ concluida: false }],
    pagamentos: {
      aVencer: [
        { descricao: 'Conta de luz', valorCentavos: 12000, vencimento: '2027-01-12' },
        { descricao: 'Internet', valorCentavos: 9990, vencimento: '2027-01-14' },
      ],
      vencidos: [{}, {}],
    },
  });
  assert.deepEqual(cheio, {
    titulo: 'Bom dia! Seu dia hoje',
    corpo:
      '2 agendamentos (o 1º às 09:00) · 2 remédios · 1 compromisso · Conta de luz vence hoje (R$ 120,00) · 2 contas vencidas',
    url: '/',
  });

  const umEvento = textoDoResumo({ data: '2027-01-12', ...vazio, eventos: [{ titulo: 'Rádio', inicio: '2027-01-12T19:00:00-03:00' }] });
  assert.equal(umEvento.corpo, 'Rádio às 19:00');
});

test('resumo sai às 07:00 com o dia da pessoa; dia sem nada não incomoda', async () => {
  // Dia 11 sem nada; dia 12 com um agendamento.
  await request(app)
    .post('/eventos')
    .set(ana.auth)
    .send({ titulo: 'Fisioterapia', tipo: 'fisioterapia', inicio: '2027-01-12T09:00:00-03:00', lembretesMinutosAntes: [] })
    .expect(201);

  await ciclo('2027-01-10T08:00');
  await ciclo('2027-01-11T07:00');
  assert.equal(resumos().length, 0, 'dia 11 não tem nada');

  await ciclo('2027-01-12T07:00');
  assert.equal(resumos().length, 1);
  assert.equal(resumos()[0].corpo, 'Fisioterapia às 09:00');
  assert.equal(resumos()[0].usuarioId, ana.usuario.id);
});

test('mudar a hora cancela os pendentes e reagenda; desligar para de gerar', async () => {
  const { body: padrao } = await request(app).get('/notificacoes/resumo').set(ana.auth).expect(200);
  assert.deepEqual(padrao, { ativo: true, hora: '07:00' });

  await ciclo('2027-01-20T08:00'); // gera o do dia 21 às 07:00
  assert.deepEqual(await pendentes(), ['2027-01-21T07:00:00-03:00']);

  await request(app).put('/notificacoes/resumo').set(ana.auth).send({ ativo: true, hora: '08:30' }).expect(200);
  assert.deepEqual(await pendentes(), []);
  await ciclo('2027-01-20T08:01');
  // Às 08:01 o próximo das 08:30 já é o de hoje.
  assert.deepEqual(await pendentes(), ['2027-01-20T08:30:00-03:00']);

  await request(app).put('/notificacoes/resumo').set(ana.auth).send({ ativo: false, hora: '08:30' }).expect(200);
  await ciclo('2027-01-20T08:02');
  assert.deepEqual(await pendentes(), []);
  assert.deepEqual((await request(app).get('/notificacoes/resumo').set(ana.auth)).body, { ativo: false, hora: '08:30' });

  const ruim = await request(app).put('/notificacoes/resumo').set(ana.auth).send({ ativo: true, hora: '25:00' }).expect(400);
  assert.match(ruim.body.erro.mensagem, /Hora inválida/);
  await request(app).put('/notificacoes/resumo').set(ana.auth).send({ ativo: true }).expect(400);
});
