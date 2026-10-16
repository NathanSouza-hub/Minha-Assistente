require('./setup');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { DateTime } = require('luxon');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { FUSO } = require('../src/lib/tempo');
const { gerar, enviarPendentes, executarCiclo } = require('../src/lembretes/agendador');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

// Cada teste usa uma semana diferente de novembro/dezembro de 2026, para não se misturarem.
// 2026-11-03 é terça.
const em = (iso) => DateTime.fromISO(iso, { zone: FUSO });

let app;
let ana;
let bia;
let categorias;

// Canal falso: "entrega" na memória. Só a Ana tem aparelho inscrito.
let enviados;
let falha;
const canal = {
  nome: 'app',
  ativo: () => true,
  usuarios: (conexao) => conexao('usuario').where('id', ana.usuario.id).select('id'),
  enviar: async (_conexao, usuarioId, mensagem) => {
    if (falha) throw falha;
    enviados.push({ usuarioId, ...mensagem });
    return { entregue: true };
  },
};
const opcoes = () => ({ canais: [canal] });
// Os ciclos também enviam lembretes de testes anteriores (ex.: a fisioterapia semanal): cada
// teste olha só os das suas origens (a tag leva o id da origem).
const enviadosDe = (...origens) => enviados.filter((e) => origens.some((id) => e.tag.includes(id)));

const lembretesDe = (origemId) =>
  db('lembreteEnvio').where({ origemId }).orderBy('agendadoPara').select('agendadoPara', 'status', 'erro', 'tentativas');

const post = (sessao, rota, dados) => request(app).post(rota).set(sessao.auth).send(dados).expect(201);

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  ana = await criarSessao(app);
  bia = await criarSessao(app);
  const lista = (await request(app).get('/categorias-pagamento').set(ana.auth)).body;
  categorias = Object.fromEntries(lista.map((c) => [c.nome, c.id]));
});

beforeEach(() => {
  enviados = [];
  falha = null;
});

after(async () => {
  await db.destroy();
});

test('evento: um lembrete por antecedência, com o texto relativo ao envio', async () => {
  const { body: evento } = await post(ana, '/eventos', {
    titulo: 'Cardiologista',
    tipo: 'consulta',
    inicio: '2026-11-03T14:00:00-03:00',
    local: 'Clínica Boa Saúde',
    lembretesMinutosAntes: [1080, 120],
  });

  await gerar(em('2026-11-02T19:30'), opcoes());
  assert.deepEqual(
    (await lembretesDe(evento.id)).map((l) => [l.agendadoPara, l.status]),
    [
      ['2026-11-02T20:00:00-03:00', 'pendente'],
      ['2026-11-03T12:00:00-03:00', 'pendente'],
    ],
  );

  // Gerar de novo não duplica.
  await gerar(em('2026-11-02T19:31'), opcoes());
  assert.equal((await lembretesDe(evento.id)).length, 2);

  assert.deepEqual(await enviarPendentes(em('2026-11-02T19:59'), opcoes()), {});
  await enviarPendentes(em('2026-11-02T20:00:30'), opcoes());
  await enviarPendentes(em('2026-11-03T12:01'), opcoes());
  assert.deepEqual(
    enviadosDe(evento.id).map((e) => [e.usuarioId, e.titulo, e.corpo, e.url]),
    [
      [ana.usuario.id, 'Cardiologista', 'Amanhã às 14:00 · Clínica Boa Saúde', '/agenda'],
      [ana.usuario.id, 'Cardiologista', 'Hoje às 14:00 · Clínica Boa Saúde', '/agenda'],
    ],
  );
  assert.equal(enviadosDe(evento.id)[0].tag, `evento:${evento.id}:2026-11-03T14:00:00-03:00`);
  assert.deepEqual(
    (await lembretesDe(evento.id)).map((l) => l.status),
    ['enviado', 'enviado'],
  );
});

test('evento recorrente: lembra cada ocorrência; quem não tem aparelho não recebe', async () => {
  const { body: semanal } = await post(ana, '/eventos', {
    titulo: 'Fisioterapia',
    tipo: 'reuniao_pessoal',
    inicio: '2026-10-27T09:00:00-03:00',
    recorrencia: 'semanal',
    lembretesMinutosAntes: [60],
  });
  const { body: daBia } = await post(bia, '/eventos', {
    titulo: 'Dentista',
    tipo: 'consulta',
    inicio: '2026-11-10T09:00:00-03:00',
    lembretesMinutosAntes: [60],
  });

  await gerar(em('2026-11-10T07:00'), opcoes());
  assert.deepEqual(
    (await lembretesDe(semanal.id)).map((l) => l.agendadoPara),
    ['2026-11-10T08:00:00-03:00'],
  );
  assert.deepEqual(await lembretesDe(daBia.id), []);
});

test('editar o evento cancela os pendentes; o horário que continua volta a valer', async () => {
  const { body: evento } = await post(ana, '/eventos', {
    titulo: 'Reunião do condomínio',
    tipo: 'reuniao_pessoal',
    inicio: '2026-11-17T19:00:00-03:00',
    lembretesMinutosAntes: [120, 30],
  });
  await gerar(em('2026-11-17T08:00'), opcoes());

  // Tira o lembrete de 30 min e muda o título.
  await request(app)
    .put(`/eventos/${evento.id}`)
    .set(ana.auth)
    .send({ titulo: 'Assembleia', tipo: 'reuniao_pessoal', inicio: evento.inicio, lembretesMinutosAntes: [120] })
    .expect(200);
  assert.deepEqual(
    (await lembretesDe(evento.id)).map((l) => l.status),
    ['cancelado', 'cancelado'],
  );

  await gerar(em('2026-11-17T08:01'), opcoes());
  assert.deepEqual(
    (await lembretesDe(evento.id)).map((l) => [l.agendadoPara, l.status]),
    [
      ['2026-11-17T17:00:00-03:00', 'pendente'],
      ['2026-11-17T18:30:00-03:00', 'cancelado'],
    ],
  );
  await enviarPendentes(em('2026-11-17T17:00'), opcoes());
  assert.deepEqual(
    enviadosDe(evento.id).map((e) => e.titulo),
    ['Assembleia'],
  );
});

test('remédio: lembra na hora da dose; dose já tomada não é lembrada', async () => {
  const { body: remedio } = await post(ana, '/medicamentos', {
    nome: 'Losartana',
    dose: '50 mg',
    horarios: [
      { periodo: 'manha', hora: '08:00' },
      { periodo: 'noite', hora: '20:00' },
      { periodo: 'tarde' }, // sem hora: sem lembrete
      { periodo: 'semanal', hora: '10:00', diaSemana: 3 }, // quarta
    ],
  });
  // A API devolve os horários ordenados (manhã, tarde, noite, semanal).
  const [manha, noite, semanal] = ['manha', 'noite', 'semanal'].map((p) => remedio.horarios.find((h) => h.periodo === p));
  await post(ana, '/medicamentos', { nome: 'Pausado', ativo: false, horarios: [{ periodo: 'manha', hora: '08:00' }] });

  // Terça, 24/11, 7h: as próximas 24h têm as doses de 08:00 e 20:00 de terça (a de quarta, 08:00, cai
  // fora: a janela vai até quarta às 7h).
  await gerar(em('2026-11-24T07:00'), opcoes());
  const doRemedio = await db('lembreteEnvio')
    .where({ origemTipo: 'medicamento_horario' })
    .whereBetween('agendadoPara', ['2026-11-24T00:00:00-03:00', '2026-11-26T00:00:00-03:00'])
    .orderBy('agendadoPara')
    .select('origemId', 'agendadoPara');
  assert.deepEqual(
    doRemedio.map((l) => [l.origemId, l.agendadoPara]),
    [
      [manha.id, '2026-11-24T08:00:00-03:00'],
      [noite.id, '2026-11-24T20:00:00-03:00'],
    ],
  );
  await gerar(em('2026-11-25T07:00'), opcoes());
  assert.ok((await lembretesDe(semanal.id)).some((l) => l.agendadoPara === '2026-11-25T10:00:00-03:00'));

  // Tomou a da manhã antes das 8h.
  await request(app)
    .post('/medicamentos/registros')
    .set(ana.auth)
    .send({ horarioId: manha.id, data: '2026-11-24' })
    .expect(200);
  await enviarPendentes(em('2026-11-24T08:00'), opcoes());
  await enviarPendentes(em('2026-11-24T20:00'), opcoes());
  assert.deepEqual(
    enviadosDe(manha.id, noite.id, semanal.id).map((e) => [e.titulo, e.corpo, e.url]),
    [['Hora do remédio: Losartana', '50 mg', '/remedios']],
  );
  const [lembreteManha] = await lembretesDe(manha.id);
  assert.equal(lembreteManha.status, 'cancelado');
});

test('rotina: só tarefas com lembrete, nos dias delas; tarefa feita não é lembrada', async () => {
  const { body: emails } = await post(ana, '/rotinas', {
    titulo: 'Ler e-mails',
    hora: '08:30',
    diasSemana: [1, 2, 3, 4, 5],
    lembrete: true,
  });
  const { body: semLembrete } = await post(ana, '/rotinas', { titulo: 'Regar plantas', hora: '09:00' });
  const { body: feita } = await post(ana, '/rotinas', { titulo: 'Tomar água', hora: '10:00', lembrete: true });

  // Sábado, 05/12: "Ler e-mails" é só em dia útil.
  await gerar(em('2026-12-05T07:00'), opcoes());
  assert.deepEqual(await lembretesDe(emails.id), []);
  // Segunda, 07/12.
  await gerar(em('2026-12-07T07:00'), opcoes());
  assert.deepEqual(
    (await lembretesDe(emails.id)).map((l) => l.agendadoPara),
    ['2026-12-07T08:30:00-03:00'],
  );
  assert.deepEqual(await lembretesDe(semLembrete.id), []);

  await request(app).post(`/rotinas/${feita.id}/concluir`).set(ana.auth).send({ data: '2026-12-07' }).expect(200);
  await enviarPendentes(em('2026-12-07T08:30'), opcoes());
  await enviarPendentes(em('2026-12-07T10:00'), opcoes());
  assert.deepEqual(
    enviadosDe(emails.id, semLembrete.id, feita.id).map((e) => [e.titulo, e.corpo]),
    [['Ler e-mails', 'Compromisso do dia, às 08:30.']],
  );
});

test('pagamento: véspera e dia do vencimento às 9h; pagar cancela', async () => {
  const conta = (descricao, vencimento) => ({
    descricao,
    categoriaId: categorias['Contas residenciais'],
    valorCentavos: 15990,
    vencimento,
  });
  const { body: luz } = await post(ana, '/pagamentos', conta('Conta de luz', '2026-12-15'));
  const { body: agua } = await post(ana, '/pagamentos', conta('Conta de água', '2026-12-15'));

  await gerar(em('2026-12-14T08:00'), opcoes());
  assert.deepEqual(
    (await lembretesDe(luz.id)).map((l) => l.agendadoPara),
    ['2026-12-14T09:00:00-03:00'],
  );
  await enviarPendentes(em('2026-12-14T09:00'), opcoes());
  const [daLuz] = enviadosDe(luz.id);
  assert.equal(daLuz.titulo, 'Conta vence amanhã');
  assert.match(daLuz.corpo, /^Conta de luz · R\$\s159,90$/);

  // Pagou a água antes do dia; a luz continua pendente.
  await request(app).patch(`/pagamentos/${agua.id}/pagar`).set(ana.auth).send({}).expect(200);
  await gerar(em('2026-12-15T08:00'), opcoes());
  assert.deepEqual(
    (await lembretesDe(agua.id)).map((l) => l.status),
    ['enviado'],
  );
  enviados = [];
  await enviarPendentes(em('2026-12-15T09:00'), opcoes());
  assert.deepEqual(
    enviadosDe(luz.id, agua.id).map((e) => e.titulo + ': ' + e.corpo.split(' · ')[0]),
    ['Conta vence hoje: Conta de luz'],
  );
});

test('lembrete atrasado demais não é enviado', async () => {
  const { body: evento } = await post(ana, '/eventos', {
    titulo: 'Atrasado',
    tipo: 'reuniao_pessoal',
    inicio: '2026-12-21T10:00:00-03:00',
    lembretesMinutosAntes: [60],
  });
  await gerar(em('2026-12-21T08:00'), opcoes());
  // Servidor parado das 9h às 9h20.
  await enviarPendentes(em('2026-12-21T09:20'), opcoes());
  assert.equal(enviadosDe(evento.id).length, 0);
  const [lembrete] = await lembretesDe(evento.id);
  assert.equal(lembrete.status, 'cancelado');
  assert.match(lembrete.erro, /Passou da hora/);
});

test('falha no envio tenta de novo e desiste depois de 3 tentativas', async () => {
  const { body: evento } = await post(ana, '/eventos', {
    titulo: 'Com falha',
    tipo: 'reuniao_pessoal',
    inicio: '2026-12-28T10:00:00-03:00',
    lembretesMinutosAntes: [60],
  });
  await gerar(em('2026-12-28T08:00'), opcoes());
  falha = new Error('Serviço de push fora do ar');

  await enviarPendentes(em('2026-12-28T09:00'), opcoes());
  let [lembrete] = await lembretesDe(evento.id);
  assert.deepEqual([lembrete.status, lembrete.tentativas], ['pendente', 1]);

  await enviarPendentes(em('2026-12-28T09:01'), opcoes());
  await enviarPendentes(em('2026-12-28T09:02'), opcoes());
  [lembrete] = await lembretesDe(evento.id);
  assert.deepEqual([lembrete.status, lembrete.tentativas, lembrete.erro], ['falhou', 3, 'Serviço de push fora do ar']);
});

test('sem canal ativo o ciclo não faz nada', async () => {
  assert.deepEqual(await executarCiclo(em('2026-12-28T09:00'), { canais: [] }), { gerados: 0, enviados: {} });
});
