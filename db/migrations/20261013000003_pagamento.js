const { criarTabela, checkIn, check, donoUsuario } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'pagamento', (t) => {
    donoUsuario(t);
    t.text('descricao').notNullable();
    t.uuid('categoria_id').notNullable().references('id').inTable('categoria_pagamento');
    t.uuid('imovel_id').nullable();
    // FK composta: o imóvel precisa ser do mesmo usuário. Com imovel_id nulo não é checada.
    t.foreign(['imovel_id', 'usuario_id']).references(['id', 'usuario_id']).inTable('imovel');
    t.integer('valor_centavos').notNullable();
    t.date('vencimento').notNullable();
    t.text('status').notNullable().defaultTo('pendente');
    t.date('data_pagamento').nullable();
    t.text('recorrencia').notNullable().defaultTo('nenhuma');
    t.uuid('recorrencia_origem_id').nullable().references('id').inTable('pagamento').onDelete('SET NULL');
    t.uuid('parcelamento_grupo_id').nullable();
    t.smallint('parcela_atual').nullable();
    t.smallint('parcela_total').nullable();
    t.text('observacoes').nullable();

    t.index(['usuario_id', 'vencimento']);
    t.index(['usuario_id', 'status', 'vencimento']);
    t.index(['usuario_id', 'data_pagamento']);
    t.index(['categoria_id']);
    t.index(['imovel_id']);
    t.index(['parcelamento_grupo_id']);
  });

  await checkIn(knex, 'pagamento', 'status', ['pendente', 'pago']);
  await checkIn(knex, 'pagamento', 'recorrencia', ['nenhuma', 'mensal', 'anual']);
  await check(knex, 'pagamento', 'valor_positivo', 'valor_centavos > 0');
  await check(knex, 'pagamento', 'pago_tem_data', "(status = 'pago') = (data_pagamento IS NOT NULL)");
  await check(
    knex,
    'pagamento',
    'parcelas',
    `(parcelamento_grupo_id IS NULL AND parcela_atual IS NULL AND parcela_total IS NULL)
     OR (parcelamento_grupo_id IS NOT NULL AND parcela_atual BETWEEN 1 AND parcela_total)`,
  );
  await check(
    knex,
    'pagamento',
    'parcelado_nao_recorrente',
    "parcelamento_grupo_id IS NULL OR recorrencia = 'nenhuma'",
  );
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('pagamento');
};
