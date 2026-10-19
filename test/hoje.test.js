require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Settings } = require('luxon');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { painel } = require('../src/modules/hoje/service');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

// Dia dos testes: 2026-10-19 (segunda, diaSemana 1). O relógio do Luxon fica parado ao meio-dia
// desse dia: o que tem horário antes disso (ou vencimento antes do dia) e está pendente fica atrasado.
const DIA = '2026-10-19';
const MEIO_DIA = Date.parse(`${DIA}T12:00:00-03:00`);
const relogioReal = Settings.now;

let app;
let sessao;
let remedio;

const post = (rota, corpo) => request(app).post(rota).set(sessao.auth).send(corpo).expect(201);

const tarefasDoDia = async (sessaoAtual = sessao, query = { data: DIA }) =>
  (await request(app).get('/hoje').query(query).set(sessaoAtual.auth).expect(200)).body;

const marcar = (id, status, esperado = 200) =>
  request(app).patch(`/hoje/${encodeURIComponent(id)}`).set(sessao.auth).send({ status }).expect(esperado);

const daLista = async (filtro) => (await tarefasDoDia()).tarefas.find(filtro);
const comTitulo = (titulo) => daLista((t) => t.titulo === titulo);
const totalDeRegistros = async (onde = {}) =>
  (await db('tarefaRegistro').where(onde).count('* as total').first()).total;

before(async () => {
  await prepararBanco(db);
  Settings.now = () => MEIO_DIA;
  app = criarApp();
  sessao = await criarSessao(app);

  // Agenda: um evento no dia, um programa de rádio semanal que cai no dia, um em outro dia.
  await post('/eventos', { titulo: 'consulta', tipo: 'consulta', inicio: `${DIA}T10:00:00-03:00`, local: 'Clínica' });
  await post('/eventos', {
    titulo: 'Programa de rádio',
    tipo: 'programa_radio',
    inicio: '2026-10-05T07:00:00-03:00',
    recorrencia: 'semanal',
  });
  await post('/eventos', { titulo: 'Amanhã', tipo: 'exame', inicio: '2026-10-20T08:00:00-03:00' });

  // Remédios: um diário (tomado) e um semanal de segunda.
  ({ body: remedio } = await post('/medicamentos', {
    nome: 'losartana',
    dose: '50 mg',
    horarios: [
      { periodo: 'manha', hora: '08:00' },
      { periodo: 'semanal', hora: '13:00', diaSemana: 1 },
    ],
  }));
  await request(app)
    .post('/medicamentos/registros')
    .set(sessao.auth)
    .send({ horarioId: remedio.horarios[0].id, data: DIA })
    .expect(200);

  // Rotina: uma concluída, uma pendente, uma só aos domingos.
  const { body: emails } = await post('/rotinas', { titulo: 'Ler e-mails', ordem: 1 });
  await post('/rotinas', { titulo: 'Enviar mensagens', ordem: 2 });
  await post('/rotinas', { titulo: 'Só domingo', diasSemana: [0] });
  await request(app).post(`/rotinas/${emails.id}/concluir`).set(sessao.auth).send({ data: DIA }).expect(200);

  // Viagem com ida no dia.
  await post('/viagens', { destino: 'Gramado', ida: DIA, volta: '2026-10-25', transporte: 'Avião' });

  // Pagamentos
  const categorias = (await request(app).get('/categorias-pagamento').set(sessao.auth)).body;
  const { body: casa } = await post('/imoveis', { nome: 'Casa da Serra' });
  const pagamento = (descricao, vencimento, extra = {}) =>
    post('/pagamentos', { descricao, categoriaId: categorias[0].id, valorCentavos: 10000, vencimento, ...extra });
  await pagamento('Vencido', '2026-10-10');
  await pagamento('Vence hoje', DIA, { imovelId: casa.id, valorCentavos: 330000 });
  await pagamento('Vence em 7 dias', '2026-10-26');
  await pagamento('Já pago', '2026-10-15', { status: 'pago', dataPagamento: '2026-10-15' });
});

after(async () => {
  Settings.now = relogioReal;
  await db.destroy();
});

test('lista única do dia em ordem de horário, com status e resumo', async () => {
  const { data, resumo, tarefas } = await tarefasDoDia();
  assert.equal(data, DIA);

  assert.deepEqual(
    tarefas.map((t) => [t.horario, t.categoria, t.titulo, t.status]),
    [
      ['07:00', 'radio', 'Programa de rádio', 'atrasado'],
      ['08:00', 'remedio', 'Losartana', 'feito'],
      ['10:00', 'agenda', 'Consulta', 'atrasado'],
      ['13:00', 'remedio', 'Losartana', 'pendente'],
      [null, 'compromisso', 'Ler e-mails', 'feito'],
      [null, 'compromisso', 'Enviar mensagens', 'pendente'],
      [null, 'viagem', 'Viagem para Gramado', 'pendente'],
      [null, 'despesa', 'Vencido', 'atrasado'],
      [null, 'despesa', 'Vence hoje', 'pendente'],
    ],
  );
  assert.deepEqual(resumo, { programadas: 9, concluidas: 2, pendentes: 4, atrasadas: 3 });

  const porTitulo = Object.fromEntries(tarefas.map((t) => [t.titulo, t]));
  assert.equal(tarefas[1].detalhe, '50 mg');
  assert.equal(tarefas[1].id, `remedio:${remedio.horarios[0].id}:${DIA}T08:00`);
  assert.equal(tarefas[1].link, `/remedios/${remedio.id}`);
  assert.equal(porTitulo.Consulta.detalhe, 'Clínica');
  assert.equal(porTitulo['Programa de rádio'].link, '/radio');
  assert.equal(porTitulo['Viagem para Gramado'].detalhe, 'Ida · Avião');
  assert.match(porTitulo['Vence hoje'].detalhe, /^R\$\s3\.300,00 · Casa da Serra$/);
  assert.match(porTitulo.Vencido.detalhe, /100,00 · Venceu em 10\/10$/);
  assert.ok(tarefas.every((t) => t.concluirNoFormulario === false));
});

test('outro dia (domingo): só o que ocorre nele, sem as contas vencidas antes', async () => {
  const { tarefas } = await tarefasDoDia(sessao, { data: '2026-10-25' });
  assert.deepEqual(
    tarefas.map((t) => [t.titulo, t.status]),
    [
      ['Losartana', 'pendente'],
      ['Só domingo', 'pendente'],
      ['Ler e-mails', 'pendente'],
      ['Enviar mensagens', 'pendente'],
      ['Viagem para Gramado', 'pendente'],
    ],
  );
  assert.equal(tarefas[4].detalhe, 'Volta · Avião');
});

test('remédio: ✓ vale na tela de remédios, ✗ desmarca o tomado e pendente desfaz', async () => {
  const semanal = await daLista((t) => t.horario === '13:00');
  const tomadoNoModulo = async () =>
    (await request(app).get('/medicamentos/hoje').query({ data: DIA }).set(sessao.auth)).body.find(
      (d) => d.horarioId === remedio.horarios[1].id,
    ).tomado;

  assert.equal((await marcar(semanal.id, 'feito')).body.status, 'feito');
  assert.equal(await tomadoNoModulo(), true);

  assert.equal((await marcar(semanal.id, 'nao_feito')).body.status, 'nao_feito');
  assert.equal(await tomadoNoModulo(), false);

  assert.equal((await marcar(semanal.id, 'pendente')).body.status, 'pendente');
  assert.equal(await totalDeRegistros(), 0);
});

test('despesa: ✓ marca como pago (com a data de hoje) e pendente desfaz', async () => {
  const vencido = await comTitulo('Vencido');
  const pagamentoId = vencido.id.split(':')[1];
  const conta = async () => (await request(app).get(`/pagamentos/${pagamentoId}`).set(sessao.auth)).body;

  assert.equal((await marcar(vencido.id, 'feito')).body.status, 'feito');
  assert.deepEqual(await conta().then((c) => [c.status, c.dataPagamento]), ['pago', DIA]);
  assert.equal((await comTitulo('Vencido')).status, 'feito');

  assert.equal((await marcar(vencido.id, 'pendente')).body.status, 'atrasado');
  assert.deepEqual(await conta().then((c) => [c.status, c.dataPagamento]), ['pendente', null]);
});

test('agenda, viagem e compromisso: ✓/✗ guardados por ocorrência', async () => {
  const consulta = await comTitulo('Consulta');
  assert.equal((await marcar(consulta.id, 'nao_feito')).body.status, 'nao_feito');
  assert.equal((await marcar(consulta.id, 'feito')).body.status, 'feito');
  assert.equal((await comTitulo('Consulta')).status, 'feito');

  // Item sem horário: marcar de novo atualiza a mesma linha.
  const viagem = await comTitulo('Viagem para Gramado');
  await marcar(viagem.id, 'feito');
  await marcar(viagem.id, 'nao_feito');
  assert.equal((await comTitulo('Viagem para Gramado')).status, 'nao_feito');
  assert.equal(await totalDeRegistros({ categoria: 'viagem' }), 1);
  await marcar(viagem.id, 'pendente');
  assert.equal((await comTitulo('Viagem para Gramado')).status, 'pendente');
  assert.equal(await totalDeRegistros({ categoria: 'viagem' }), 0);

  // Rádio recorrente: o ✓ desta semana não marca a próxima.
  const radio = await comTitulo('Programa de rádio');
  await marcar(radio.id, 'feito');
  const semanaQueVem = await tarefasDoDia(sessao, { data: '2026-10-26' });
  assert.equal(semanaQueVem.tarefas.find((t) => t.categoria === 'radio').status, 'pendente');

  const mensagens = await comTitulo('Enviar mensagens');
  await marcar(mensagens.id, 'feito');
  const rotina = (await request(app).get('/rotinas/hoje').query({ data: DIA }).set(sessao.auth)).body;
  assert.equal(rotina.find((t) => t.titulo === 'Enviar mensagens').concluida, true);
});

test('conta da equipe com valor a definir: o ✓ fica para o formulário da conta', async () => {
  const outra = await criarSessao(app);
  await request(app)
    .post('/equipe')
    .set(outra.auth)
    .send({ nome: 'joana', funcao: 'Cuidadora', formaPagamento: 'mensal', dias: [{ dia: 19 }] })
    .expect(201);
  const [conta] = (await tarefasDoDia(outra)).tarefas;
  assert.equal(conta.categoria, 'despesa');
  assert.equal(conta.detalhe, 'Valor a definir');
  assert.equal(conta.concluirNoFormulario, true);
  await request(app)
    .patch(`/hoje/${encodeURIComponent(conta.id)}`)
    .set(outra.auth)
    .send({ status: 'feito' })
    .expect(400);
  // O ✗ vale normalmente.
  const { body } = await request(app)
    .patch(`/hoje/${encodeURIComponent(conta.id)}`)
    .set(outra.auth)
    .send({ status: 'nao_feito' })
    .expect(200);
  assert.equal(body.status, 'nao_feito');
});

test('id de outro usuário ou de outro dia responde 404; id e status inválidos 400', async () => {
  const consulta = await comTitulo('Consulta');
  const outro = await criarSessao(app);
  await request(app)
    .patch(`/hoje/${encodeURIComponent(consulta.id)}`)
    .set(outro.auth)
    .send({ status: 'feito' })
    .expect(404);
  await marcar(consulta.id.replace(DIA, '2026-10-20'), 'feito', 404);
  await marcar('remedio:nao-e-uuid:2026-10-19', 'feito', 400);
  await marcar(consulta.id.replace(DIA, '2026-02-30'), 'feito', 400);
  await marcar(consulta.id, 'atrasado', 400);
});

test('sem data usa hoje; usuário novo não tem tarefas; sem token 401', async () => {
  const novo = await criarSessao(app);
  assert.deepEqual(await tarefasDoDia(novo, {}), {
    data: DIA,
    resumo: { programadas: 0, concluidas: 0, pendentes: 0, atrasadas: 0 },
    tarefas: [],
  });
  await request(app).get('/hoje').query({ data: '2026-02-30' }).set(sessao.auth).expect(400);
  await request(app).get('/hoje').expect(401);
});

test('painel do resumo da manhã continua juntando agenda, remédios, rotina e pagamentos', async () => {
  const p = await painel(sessao.usuario.id, { data: '2026-10-26' });
  assert.deepEqual(p.eventos.map((e) => e.titulo), ['Programa de rádio']);
  assert.equal(p.medicamentos.length, 2);
  assert.equal(p.rotina.length, 2);
  assert.deepEqual(p.pagamentos.aVencer.map((x) => x.descricao), ['Vence em 7 dias']);
  assert.deepEqual(p.pagamentos.vencidos.map((x) => x.descricao).sort(), ['Vence hoje', 'Vencido']);
});
