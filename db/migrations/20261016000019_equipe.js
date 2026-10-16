// Equipe: pessoas que recebem (por mês, plantão ou honorário) em dias fixos do mês. O app cria
// sozinho a conta de cada dia de pagamento em `pagamento` (membro_id), que pode ficar com o valor
// a definir enquanto estiver pendente.
const { criarTabela, checkIn, check, donoUsuario } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'membro_equipe', (t) => {
    donoUsuario(t);
    t.text('nome').notNullable();
    t.text('funcao').nullable();
    t.text('forma_pagamento').notNullable();
    t.text('chave_pix').nullable();
    t.boolean('ativo').notNullable().defaultTo(true);
    // Alvo da FK composta de pagamento: garante pessoa do mesmo dono.
    t.unique(['id', 'usuario_id']);
  });
  await knex.raw(
    'CREATE UNIQUE INDEX membro_equipe_usuario_nome_unique ON membro_equipe (usuario_id, lower(nome))',
  );
  await checkIn(knex, 'membro_equipe', 'forma_pagamento', ['mensal', 'plantao', 'honorario']);

  // `desde`: contas deste dia só nascem a partir desta data (cadastro novo não cria conta vencida).
  await criarTabela(knex, 'membro_equipe_dia', (t) => {
    t.uuid('membro_id').notNullable().references('id').inTable('membro_equipe').onDelete('CASCADE');
    t.smallint('dia').notNullable();
    t.integer('valor_previsto_centavos').nullable();
    t.date('desde').notNullable().defaultTo(knex.raw('current_date'));
    t.unique(['membro_id', 'dia']);
  });
  await check(knex, 'membro_equipe_dia', 'dia', 'dia BETWEEN 1 AND 31');
  await check(
    knex,
    'membro_equipe_dia',
    'valor_positivo',
    'valor_previsto_centavos IS NULL OR valor_previsto_centavos > 0',
  );

  // Conta da equipe que a pessoa apagou: não é criada de novo naquele dia.
  await knex.schema.createTable('membro_equipe_dispensa', (t) => {
    t.uuid('membro_id').notNullable().references('id').inTable('membro_equipe').onDelete('CASCADE');
    t.date('vencimento').notNullable();
    t.primary(['membro_id', 'vencimento']);
  });

  await knex.schema.alterTable('pagamento', (t) => {
    t.integer('valor_centavos').nullable().alter();
    t.uuid('membro_id').nullable();
    t.foreign(['membro_id', 'usuario_id']).references(['id', 'usuario_id']).inTable('membro_equipe');
    // Uma conta por pessoa por dia: criar de novo não duplica.
    t.unique(['membro_id', 'vencimento']);
  });
  await knex.raw('ALTER TABLE pagamento DROP CONSTRAINT pagamento_tem_categoria_check');
  await check(
    knex,
    'pagamento',
    'tem_categoria',
    'cartao_id IS NOT NULL OR membro_id IS NOT NULL OR categoria_id IS NOT NULL',
  );
  await check(
    knex,
    'pagamento',
    'equipe_simples',
    `membro_id IS NULL OR (categoria_id IS NULL AND cartao_id IS NULL AND recorrencia = 'nenhuma'
     AND parcelamento_grupo_id IS NULL)`,
  );
  // Só a conta da equipe pendente pode ficar sem valor.
  await check(
    knex,
    'pagamento',
    'tem_valor',
    "valor_centavos IS NOT NULL OR (membro_id IS NOT NULL AND status = 'pendente')",
  );
};

exports.down = async (knex) => {
  await knex('pagamento').whereNotNull('membro_id').del();
  for (const nome of ['tem_valor', 'equipe_simples', 'tem_categoria']) {
    await knex.raw('ALTER TABLE pagamento DROP CONSTRAINT ??', [`pagamento_${nome}_check`]);
  }
  await check(knex, 'pagamento', 'tem_categoria', 'cartao_id IS NOT NULL OR categoria_id IS NOT NULL');
  await knex.schema.alterTable('pagamento', (t) => {
    t.dropUnique(['membro_id', 'vencimento']);
    t.dropForeign(['membro_id', 'usuario_id']);
    t.dropColumn('membro_id');
    t.integer('valor_centavos').notNullable().alter();
  });
  await knex.schema.dropTable('membro_equipe_dispensa');
  await knex.schema.dropTable('membro_equipe_dia');
  await knex.schema.dropTable('membro_equipe');
};
