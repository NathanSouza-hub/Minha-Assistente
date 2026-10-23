require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/config/db');
const { criarApp } = require('../src/app');
const { prepararBanco } = require('./helpers/banco');
const { criarSessao } = require('./helpers/sessao');

let app;
let sessao;
let outra;

const relatorio = async (query, status = 200, s = sessao) =>
  (await request(app).get('/relatorios/produtividade').query(query).set(s.auth).expect(status)).body;

const novaTarefa = async (titulo, s = sessao) =>
  (await request(app).post('/tarefas').set(s.auth).send({ titulo, data: '2026-10-01' }).expect(201)).body;

const concluirTarefa = (id, concluida = true, s = sessao) =>
  request(app).patch(`/tarefas/${id}/concluir`).set(s.auth).send({ concluida }).expect(200);

// A conclusão é gravada com now(); nos testes, o instante vem fixo pelo banco.
const concluidaEm = (tabela, where, instante) => db(tabela).where(where).update({ concluidaEm: instante });

async function tarefaFeitaEm(titulo, instante, s = sessao) {
  const t = await novaTarefa(titulo, s);
  await concluirTarefa(t.id, true, s);
  await concluidaEm('tarefa', { id: t.id }, instante);
  return t;
}

async function compromissoFeitoEm(rotinaId, data, instante) {
  await request(app).post(`/rotinas/${rotinaId}/concluir`).set(sessao.auth).send({ data }).expect(200);
  await concluidaEm('rotinaConclusao', { rotinaId, data }, instante);
}

const dia = (r, data) => r.dias.find((d) => d.data === data);

before(async () => {
  await prepararBanco(db);
  app = criarApp();
  sessao = await criarSessao(app);
  outra = await criarSessao(app);

  // Virada do dia no fuso de São Paulo: 23:30 de 05/10 (02:30 UTC de 06/10) é dia 5.
  await tarefaFeitaEm('Tarde da noite', '2026-10-05T23:30:00-03:00');
  await tarefaFeitaEm('Logo depois da meia-noite', '2026-10-06T00:10:00-03:00');
  // Limites: 30/09 e 01/11 ficam fora de outubro.
  await tarefaFeitaEm('Antes do período', '2026-09-30T23:59:00-03:00');
  await tarefaFeitaEm('Primeiro instante', '2026-10-01T00:00:00-03:00');
  await tarefaFeitaEm('Último instante', '2026-10-31T23:59:59-03:00');
  await tarefaFeitaEm('Depois do período', '2026-11-01T00:00:00-03:00');

  // Reaberta: concluida_em volta a NULL e não conta.
  const reaberta = await tarefaFeitaEm('Reaberta', '2026-10-10T10:00:00-03:00');
  await concluirTarefa(reaberta.id, false);
  // Excluída depois de feita: o registro some e não conta.
  const excluida = await tarefaFeitaEm('Excluída', '2026-10-10T11:00:00-03:00');
  await request(app).delete(`/tarefas/${excluida.id}`).set(sessao.auth).expect(204);
  // Pendente nunca conta.
  await novaTarefa('Ainda pendente');

  // Compromissos: conta a data da conclusão (marcar ontem hoje conta hoje).
  const leitura = (
    await request(app).post('/rotinas').set(sessao.auth).send({ titulo: 'Ler e-mails', diasSemana: [0, 1, 2, 3, 4, 5, 6] }).expect(201)
  ).body;
  await compromissoFeitoEm(leitura.id, '2026-10-05', '2026-10-05T08:40:00-03:00');
  await compromissoFeitoEm(leitura.id, '2026-10-09', '2026-10-10T09:00:00-03:00');
  // Pausado depois: o que foi feito continua contando.
  await db('rotina').where({ id: leitura.id }).update({ ativo: false });

  const apagado = (
    await request(app).post('/rotinas').set(sessao.auth).send({ titulo: 'Regar', diasSemana: [0, 1, 2, 3, 4, 5, 6] }).expect(201)
  ).body;
  await compromissoFeitoEm(apagado.id, '2026-10-05', '2026-10-05T07:00:00-03:00');
  await request(app).delete(`/rotinas/${apagado.id}`).set(sessao.auth).expect(204);

  // Outro usuário no mesmo dia não entra.
  await tarefaFeitaEm('De outra pessoa', '2026-10-05T12:00:00-03:00', outra);
});

after(() => db.destroy());

test('conta por dia de conclusão no fuso de São Paulo, com os limites do período inclusivos', async () => {
  const r = await relatorio({ inicio: '2026-10-01', fim: '2026-10-31' });
  assert.equal(r.inicio, '2026-10-01');
  assert.equal(r.fim, '2026-10-31');
  assert.equal(r.dias.length, 31);
  assert.deepEqual(dia(r, '2026-10-01'), { data: '2026-10-01', tarefas: 1, compromissos: 0, total: 1 });
  assert.deepEqual(dia(r, '2026-10-05'), { data: '2026-10-05', tarefas: 1, compromissos: 1, total: 2 });
  assert.deepEqual(dia(r, '2026-10-06'), { data: '2026-10-06', tarefas: 1, compromissos: 0, total: 1 });
  assert.deepEqual(dia(r, '2026-10-31'), { data: '2026-10-31', tarefas: 1, compromissos: 0, total: 1 });
  // Marcado em 10/10 (para o dia 9): conta no dia em que foi marcado.
  assert.equal(dia(r, '2026-10-09').compromissos, 0);
  assert.equal(dia(r, '2026-10-10').compromissos, 1);
  assert.deepEqual(r.total, { tarefas: 4, compromissos: 2, total: 6 });
});

test('reaberta, excluída, pendente, compromisso excluído e outro usuário não contam', async () => {
  const r = await relatorio({ inicio: '2026-10-10', fim: '2026-10-10' });
  // Só a conclusão do compromisso pausado; reaberta e excluída sumiram.
  assert.deepEqual(r.total, { tarefas: 0, compromissos: 1, total: 1 });
  const outraPessoa = await relatorio({ inicio: '2026-10-01', fim: '2026-10-31' }, 200, outra);
  assert.deepEqual(outraPessoa.total, { tarefas: 1, compromissos: 0, total: 1 });
});

test('período vazio vem com todos os dias zerados (não é erro nem falta de dado)', async () => {
  const r = await relatorio({ inicio: '2026-12-01', fim: '2026-12-07' });
  assert.equal(r.dias.length, 7);
  assert.ok(r.dias.every((d) => d.tarefas === 0 && d.compromissos === 0 && d.total === 0));
  assert.deepEqual(r.total, { tarefas: 0, compromissos: 0, total: 0 });
});

test('semanas de segunda a domingo, recortadas ao período, somando os mesmos dias', async () => {
  // 01/10/2026 é quinta: a primeira semana vai de quinta a domingo.
  const r = await relatorio({ inicio: '2026-10-01', fim: '2026-10-14' });
  assert.deepEqual(
    r.semanas.map((s) => [s.inicio, s.fim]),
    [
      ['2026-10-01', '2026-10-04'],
      ['2026-10-05', '2026-10-11'],
      ['2026-10-12', '2026-10-14'],
    ],
  );
  assert.deepEqual(r.semanas[0], { inicio: '2026-10-01', fim: '2026-10-04', tarefas: 1, compromissos: 0, total: 1 });
  assert.deepEqual(r.semanas[1], { inicio: '2026-10-05', fim: '2026-10-11', tarefas: 2, compromissos: 2, total: 4 });
  assert.equal(r.semanas.reduce((s, x) => s + x.total, 0), r.total.total);
});

test('uma consulta só ao banco para o período inteiro (sem uma por dia)', async () => {
  const consultas = [];
  const ouvir = (q) => /tarefa|rotina_conclusao/.test(q.sql) && consultas.push(q.sql);
  db.on('query', ouvir);
  try {
    await relatorio({ inicio: '2026-01-01', fim: '2026-12-31' });
  } finally {
    db.off('query', ouvir);
  }
  assert.equal(consultas.length, 1);
});

test('valida datas, intervalo invertido e tamanho do período', async () => {
  const erro = async (query) => (await relatorio(query, 400)).erro;
  assert.equal((await erro({ inicio: '2026-13-01', fim: '2026-12-31' })).codigo, 'VALIDACAO');
  assert.equal((await erro({ inicio: '2026-10-01' })).codigo, 'VALIDACAO');
  assert.match((await erro({ inicio: '2026-10-31', fim: '2026-10-01' })).mensagem, /anterior ou igual/);
  assert.match((await erro({ inicio: '2024-01-01', fim: '2025-01-01' })).mensagem, /366 dias/);
  // 366 dias cabem (ano bissexto inteiro).
  const r = await relatorio({ inicio: '2024-01-01', fim: '2024-12-31' });
  assert.equal(r.dias.length, 366);
});

test('exige login', async () => {
  await request(app).get('/relatorios/produtividade').query({ inicio: '2026-10-01', fim: '2026-10-31' }).expect(401);
});
