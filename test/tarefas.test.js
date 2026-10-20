require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { DateTime } = require('luxon');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { FUSO, hoje } = require('../src/lib/tempo');
const { gerar, enviarPendentes } = require('../src/lembretes/agendador');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;
let ana;
let bia;

const nova = async (sessao, dados) =>
  (await request(app).post('/tarefas').set(sessao.auth).send(dados).expect(201)).body;
const diaRelativo = (dias) => DateTime.fromISO(hoje()).plus({ days: dias }).toISODate();
const tarefasDeHoje = async (sessao) =>
  (await request(app).get('/hoje').set(sessao.auth).expect(200)).body.tarefas.filter((t) => t.categoria === 'tarefa');

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
});

after(async () => {
  await db.destroy();
});

test('cria, lista pela data, edita e exclui', async () => {
  const t = await nova(ana, { titulo: '  Ler e-mails  ', data: '2099-03-10', hora: '08:30', detalhes: 'Caixa do banco' });
  assert.equal(t.titulo, 'Ler e-mails');
  assert.equal(t.hora, '08:30');
  assert.equal(t.concluida, false);
  assert.equal(t.concluidaEm, null);
  assert.equal(t.atrasada, false);
  assert.equal(t.lembrete, false);

  await nova(ana, { titulo: 'Organizar documentos', data: '2099-03-10' });
  await nova(ana, { titulo: 'Enviar mensagem ao contador', data: '2099-03-09', hora: '10:00' });
  const lista = (await request(app).get('/tarefas').query({ inicio: '2099-03-01', fim: '2099-03-31' }).set(ana.auth)).body;
  assert.deepEqual(
    lista.map((x) => x.titulo),
    ['Enviar mensagem ao contador', 'Ler e-mails', 'Organizar documentos'],
  );

  const editada = (
    await request(app).put(`/tarefas/${t.id}`).set(ana.auth).send({ titulo: 'Ler e-mails e WhatsApp', data: '2099-03-11' }).expect(200)
  ).body;
  assert.equal(editada.titulo, 'Ler e-mails e WhatsApp');
  assert.equal(editada.hora, null);

  await request(app).delete(`/tarefas/${t.id}`).set(ana.auth).expect(204);
  await request(app).get(`/tarefas/${t.id}`).set(ana.auth).expect(404);
});

test('conclui guardando quando, reabre e filtra por situação', async () => {
  const t = await nova(ana, { titulo: 'Conferir pagamentos', data: '2099-04-01' });
  const feita = (await request(app).patch(`/tarefas/${t.id}/concluir`).set(ana.auth).expect(200)).body;
  assert.equal(feita.concluida, true);
  assert.ok(feita.concluidaEm);
  // Concluir de novo mantém a primeira conclusão.
  const denovo = (await request(app).patch(`/tarefas/${t.id}/concluir`).set(ana.auth).send({ concluida: true }).expect(200)).body;
  assert.equal(denovo.concluidaEm, feita.concluidaEm);

  const concluidas = (
    await request(app).get('/tarefas').query({ inicio: '2099-04-01', fim: '2099-04-01', situacao: 'concluida' }).set(ana.auth)
  ).body;
  assert.deepEqual(concluidas.map((x) => x.id), [t.id]);

  const reaberta = (await request(app).patch(`/tarefas/${t.id}/concluir`).set(ana.auth).send({ concluida: false }).expect(200)).body;
  assert.equal(reaberta.concluida, false);
  assert.equal(reaberta.concluidaEm, null);
});

test('validações e isolamento', async () => {
  const semHora = await request(app).post('/tarefas').set(ana.auth).send({ titulo: 'Ligar', data: '2099-01-01', lembrete: true }).expect(400);
  assert.match(semHora.body.erro.mensagem, /hora/);
  await request(app).post('/tarefas').set(ana.auth).send({ titulo: '', data: '2099-01-01' }).expect(400);
  await request(app).post('/tarefas').set(ana.auth).send({ titulo: 'x', data: '2099-02-30' }).expect(400);

  const t = await nova(ana, { titulo: 'Só da Ana', data: '2099-01-01' });
  await request(app).get(`/tarefas/${t.id}`).set(bia.auth).expect(404);
  await request(app).put(`/tarefas/${t.id}`).set(bia.auth).send({ titulo: 'x', data: '2099-01-01' }).expect(404);
  await request(app).patch(`/tarefas/${t.id}/concluir`).set(bia.auth).expect(404);
  await request(app).delete(`/tarefas/${t.id}`).set(bia.auth).expect(404);
  await request(app).get('/tarefas').expect(401);
});

test('tela Hoje: tarefas do dia e atrasadas, com ✓ concluindo a própria tarefa e ✗ só no registro', async () => {
  const carla = await criarSessao(app);
  const doDia = await nova(carla, { titulo: 'ligar para o dentista', data: hoje(), hora: '23:59' });
  await nova(carla, { titulo: 'Organizar documentos', data: diaRelativo(-2) });
  await nova(carla, { titulo: 'Amanhã', data: diaRelativo(1) });

  let lista = await tarefasDeHoje(carla);
  assert.deepEqual(lista.map((t) => t.titulo), ['Ligar para o dentista', 'Organizar documentos']);
  const [doDiaHoje, atrasadaHoje] = lista;
  assert.equal(doDiaHoje.horario, '23:59');
  assert.equal(doDiaHoje.status, 'pendente');
  assert.equal(doDiaHoje.link, `/tarefas/${doDia.id}`);
  assert.equal(atrasadaHoje.horario, null);
  assert.equal(atrasadaHoje.status, 'atrasado');
  assert.match(atrasadaHoje.detalhe, /^Era para \d{2}\/\d{2}$/);

  // ✓ na tela Hoje conclui a tarefa (vale também em /tarefas).
  await request(app).patch(`/hoje/${encodeURIComponent(doDiaHoje.id)}`).set(carla.auth).send({ status: 'feito' }).expect(200);
  assert.equal((await request(app).get(`/tarefas/${doDia.id}`).set(carla.auth)).body.concluida, true);

  // A atrasada concluída hoje continua na lista (para desfazer).
  await request(app).patch(`/hoje/${encodeURIComponent(atrasadaHoje.id)}`).set(carla.auth).send({ status: 'feito' }).expect(200);
  lista = await tarefasDeHoje(carla);
  assert.deepEqual(lista.map((t) => t.status), ['feito', 'feito']);

  // ✗ reabre a tarefa e fica só no registro da tela Hoje.
  await request(app).patch(`/hoje/${encodeURIComponent(doDiaHoje.id)}`).set(carla.auth).send({ status: 'nao_feito' }).expect(200);
  assert.equal((await request(app).get(`/tarefas/${doDia.id}`).set(carla.auth)).body.concluida, false);
  assert.equal((await tarefasDeHoje(carla))[0].status, 'nao_feito');
});

test('lembrete: na hora da tarefa; concluída não é lembrada; editar refaz', async () => {
  const em = (iso) => DateTime.fromISO(iso, { zone: FUSO });
  const enviados = [];
  const canal = {
    nome: 'app',
    ativo: () => true,
    usuarios: (conexao) => conexao('usuario').where('id', ana.usuario.id).select('id'),
    enviar: async (_c, usuarioId, mensagem) => {
      enviados.push({ usuarioId, ...mensagem });
      return { entregue: true };
    },
  };
  const opcoes = { canais: [canal] };

  const ligar = await nova(ana, { titulo: 'Ligar para a Joana', data: '2027-02-10', hora: '15:00', lembrete: true });
  const feita = await nova(ana, { titulo: 'Pagar boleto', data: '2027-02-10', hora: '16:00', lembrete: true });
  await nova(ana, { titulo: 'Sem lembrete', data: '2027-02-10', hora: '17:00' });

  await gerar(em('2027-02-10T08:00'), opcoes);
  const pendentes = await db('lembreteEnvio').where({ origemTipo: 'tarefa' }).whereIn('origemId', [ligar.id, feita.id]);
  assert.equal(pendentes.length, 2);

  await request(app).patch(`/tarefas/${feita.id}/concluir`).set(ana.auth).expect(200);
  await enviarPendentes(em('2027-02-10T15:00'), opcoes);
  await enviarPendentes(em('2027-02-10T16:00'), opcoes);
  assert.deepEqual(
    enviados.filter((e) => e.tag.includes(ligar.id) || e.tag.includes(feita.id)).map((e) => [e.titulo, e.corpo, e.url]),
    [['Ligar para a Joana', 'Tarefa de hoje, às 15:00.', '/hoje']],
  );

  // Editar cancela os pendentes (o agendador gera de novo com a hora nova).
  const outra = await nova(ana, { titulo: 'Reunião rápida', data: '2027-02-11', hora: '09:00', lembrete: true });
  await gerar(em('2027-02-11T07:00'), opcoes);
  await request(app)
    .put(`/tarefas/${outra.id}`)
    .set(ana.auth)
    .send({ titulo: 'Reunião rápida', data: '2027-02-11', hora: '10:00', lembrete: true })
    .expect(200);
  assert.deepEqual((await db('lembreteEnvio').where({ origemId: outra.id })).map((l) => l.status), ['cancelado']);
  await gerar(em('2027-02-11T07:01'), opcoes);
  const depois = await db('lembreteEnvio').where({ origemId: outra.id, status: 'pendente' });
  assert.equal(depois.length, 1);
  assert.equal(DateTime.fromISO(depois[0].agendadoPara).setZone(FUSO).toFormat('HH:mm'), '10:00');
});
