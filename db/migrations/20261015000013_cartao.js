// Cartões de crédito. As compras guardam o total e o número de parcelas; as parcelas são
// calculadas (src/lib/fatura.js). A fatura de cada mês vira uma conta em `pagamento`, com
// cartao_id e competencia (dia 1 do mês do vencimento) e sem categoria.
const { criarTabela, checkIn, check, donoUsuario } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'cartao', (t) => {
    donoUsuario(t);
    t.text('nome').notNullable();
    t.text('final').nullable();
    t.text('cor').notNullable().defaultTo('azul');
    t.smallint('dia_fechamento').notNullable();
    t.smallint('dia_vencimento').notNullable();
    t.integer('limite_centavos').nullable();
    t.smallint('ordem').notNullable().defaultTo(0);
    // Alvo das FKs compostas: garante cartão do mesmo dono.
    t.unique(['id', 'usuario_id']);
  });
  await knex.raw('CREATE UNIQUE INDEX cartao_usuario_nome_unique ON cartao (usuario_id, lower(nome))');
  await checkIn(knex, 'cartao', 'cor', ['azul', 'roxo', 'verde', 'laranja', 'vermelho', 'grafite']);
  await check(knex, 'cartao', 'final', "final IS NULL OR final ~ '^[0-9]{4}$'");
  await check(knex, 'cartao', 'dias', 'dia_fechamento BETWEEN 1 AND 31 AND dia_vencimento BETWEEN 1 AND 31');
  await check(knex, 'cartao', 'limite_positivo', 'limite_centavos IS NULL OR limite_centavos > 0');

  await criarTabela(knex, 'cartao_compra', (t) => {
    t.uuid('cartao_id').notNullable().references('id').inTable('cartao').onDelete('CASCADE');
    t.text('descricao').notNullable();
    // O dono vem do cartão; o service confere que a categoria é do mesmo usuário.
    t.uuid('categoria_id').nullable().references('id').inTable('categoria_pagamento');
    t.integer('valor_total_centavos').notNullable();
    t.smallint('parcelas').notNullable().defaultTo(1);
    t.date('data_compra').notNullable();
    t.text('observacoes').nullable();
    t.index(['cartao_id', 'data_compra']);
    t.index(['categoria_id']);
  });
  await check(knex, 'cartao_compra', 'valor_positivo', 'valor_total_centavos > 0');
  await check(knex, 'cartao_compra', 'parcelas', 'parcelas BETWEEN 1 AND 48');

  await knex.schema.alterTable('pagamento', (t) => {
    t.uuid('categoria_id').nullable().alter();
    t.uuid('cartao_id').nullable();
    t.date('competencia').nullable();
    t.foreign(['cartao_id', 'usuario_id']).references(['id', 'usuario_id']).inTable('cartao');
    // Uma fatura por cartão por mês.
    t.unique(['cartao_id', 'competencia']);
  });
  await check(
    knex,
    'pagamento',
    'fatura_completa',
    '(cartao_id IS NULL) = (competencia IS NULL) AND (competencia IS NULL OR extract(day FROM competencia) = 1)',
  );
  await check(
    knex,
    'pagamento',
    'fatura_simples',
    "cartao_id IS NULL OR (categoria_id IS NULL AND recorrencia = 'nenhuma' AND parcelamento_grupo_id IS NULL)",
  );
  await check(knex, 'pagamento', 'tem_categoria', 'cartao_id IS NOT NULL OR categoria_id IS NOT NULL');
};

exports.down = async (knex) => {
  await knex('pagamento').whereNotNull('cartao_id').del();
  for (const nome of ['fatura_completa', 'fatura_simples', 'tem_categoria']) {
    await knex.raw('ALTER TABLE pagamento DROP CONSTRAINT ??', [`pagamento_${nome}_check`]);
  }
  await knex.schema.alterTable('pagamento', (t) => {
    t.dropUnique(['cartao_id', 'competencia']);
    t.dropForeign(['cartao_id', 'usuario_id']);
    t.dropColumn('cartao_id');
    t.dropColumn('competencia');
    t.uuid('categoria_id').notNullable().alter();
  });
  await knex.schema.dropTable('cartao_compra');
  await knex.schema.dropTable('cartao');
};
