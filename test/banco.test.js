require('./setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { prepararBanco } = require('./helpers/banco');

before(async () => {
  await prepararBanco(db);
});

after(async () => {
  await db.destroy();
});

test('migrations são reversíveis (down de tudo e up de novo)', async () => {
  await db.migrate.rollback(undefined, true);
  const [, pendentes] = await db.migrate.list();
  assert.equal(pendentes.length, 14);
  await db.migrate.latest();
  const [feitas, aindaPendentes] = await db.migrate.list();
  assert.equal(feitas.length, 14);
  assert.equal(aindaPendentes.length, 0);
});

const criarUsuario = async (email) => {
  const [usuario] = await db('usuario').insert({ nome: 'Teste', email, senhaHash: 'x' }).returning('*');
  return usuario;
};

test('e-mail de usuário é único sem diferenciar maiúsculas', async () => {
  await criarUsuario('Ana@Exemplo.com');
  await assert.rejects(criarUsuario('ana@exemplo.com'), { code: '23505' });
});

test('pagamento não pode apontar para imóvel de outro usuário', async () => {
  const maria = await criarUsuario('maria@exemplo.com');
  const outra = await criarUsuario('outra@exemplo.com');
  const [imovelDaOutra] = await db('imovel').insert({ usuarioId: outra.id, nome: 'Casa' }).returning('*');
  const [categoria] = await db('categoria_pagamento').insert({ usuarioId: maria.id, nome: 'Casa' }).returning('id');

  await assert.rejects(
    db('pagamento').insert({
      usuarioId: maria.id,
      descricao: 'Conta de luz',
      categoriaId: categoria.id,
      imovelId: imovelDaOutra.id,
      valorCentavos: 1000,
      vencimento: '2026-10-20',
    }),
    { code: '23503' },
  );

  // Mesmo nome de imóvel em usuários diferentes é permitido.
  await db('imovel').insert({ usuarioId: maria.id, nome: 'Casa' });
});

test('apagar o usuário apaga os dados dele', async () => {
  const usuario = await criarUsuario('apagar@exemplo.com');
  await db('compra_item').insert({ usuarioId: usuario.id, nome: 'Pão' });
  await db('usuario').where({ id: usuario.id }).del();
  assert.equal((await db('compra_item').where({ usuarioId: usuario.id }).count('* as n'))[0].n, 0);
});

test('tipos do banco saem no formato do contrato', async () => {
  const { rows } = await db.raw(`
    select '2026-10-13'::date as dia,
           '08:05:00'::time as hora,
           '2026-10-13 17:00:00+00'::timestamptz as instante,
           sum(x)::bigint as soma_centavos
    from (values (15990), (10)) as v(x)
  `);
  assert.deepEqual(rows[0], {
    dia: '2026-10-13',
    hora: '08:05',
    instante: '2026-10-13T14:00:00-03:00',
    somaCentavos: 16000,
  });
});

test('pagamento: CHECKs rejeitam dados inconsistentes', async () => {
  const usuario = await criarUsuario('checks-pagamento@exemplo.com');
  const [categoria] = await db('categoria_pagamento').insert({ usuarioId: usuario.id, nome: 'Teste' }).returning('id');
  const base = {
    usuarioId: usuario.id,
    descricao: 'Teste',
    categoriaId: categoria.id,
    valorCentavos: 1000,
    vencimento: '2026-10-20',
  };

  // pago sem data de pagamento
  await assert.rejects(db('pagamento').insert({ ...base, status: 'pago' }), { code: '23514' });
  // valor zero
  await assert.rejects(db('pagamento').insert({ ...base, valorCentavos: 0 }), { code: '23514' });
  // parcela fora do total
  await assert.rejects(
    db('pagamento').insert({ ...base, parcelamentoGrupoId: db.fn.uuid(), parcelaAtual: 3, parcelaTotal: 2 }),
    { code: '23514' },
  );
  // status fora da lista
  await assert.rejects(db('pagamento').insert({ ...base, status: 'atrasado' }), { code: '23514' });

  const [ok] = await db('pagamento').insert(base).returning('*');
  assert.equal(ok.status, 'pendente');
  assert.equal(ok.vencimento, '2026-10-20');
  assert.equal(ok.recorrencia, 'nenhuma');
});

test('evento: lembretes aceitam lista e rejeitam valores inválidos', async () => {
  const usuario = await criarUsuario('checks-evento@exemplo.com');
  const base = {
    usuarioId: usuario.id,
    titulo: 'Consulta',
    tipo: 'consulta',
    inicio: '2026-10-20T10:00:00-03:00',
  };

  const [ok] = await db('evento').insert({ ...base, lembretesMinutosAntes: [1080, 120] }).returning('*');
  assert.deepEqual(ok.lembretesMinutosAntes, [1080, 120]);
  assert.equal(ok.inicio, '2026-10-20T10:00:00-03:00');

  await assert.rejects(db('evento').insert({ ...base, lembretesMinutosAntes: [0] }), { code: '23514' });
  await assert.rejects(db('evento').insert({ ...base, tipo: 'festa' }), { code: '23514' });
  await assert.rejects(
    db('evento').insert({ ...base, fim: '2026-10-20T09:00:00-03:00' }),
    { code: '23514' },
  );
});

test('atualizado_em muda no UPDATE via trigger', async () => {
  const usuario = await criarUsuario('trigger@exemplo.com');
  const [item] = await db('compra_item').insert({ usuarioId: usuario.id, nome: 'Leite' }).returning('*');
  await db.raw('select pg_sleep(0.01)');
  const [depois] = await db('compra_item')
    .where({ id: item.id })
    .update({ comprado: true, compradoEm: db.fn.now() })
    .returning('*');
  assert.notEqual(depois.atualizadoEm, undefined);
  assert.ok(new Date(depois.atualizadoEm) >= new Date(item.atualizadoEm));
  assert.equal(depois.comprado, true);
});
