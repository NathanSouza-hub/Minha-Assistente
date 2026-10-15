// Categorias de pagamento deixam de ser globais: cada usuário tem as suas (e cria novas).
// Os dados existentes são preservados: cada usuário recebe uma cópia das categorias globais e as
// contas dele passam a apontar para a cópia de mesmo nome.

exports.up = async (knex) => {
  await knex.schema.alterTable('categoria_pagamento', (t) => {
    t.dropUnique(['nome']);
    t.uuid('usuario_id').nullable().references('id').inTable('usuario').onDelete('CASCADE');
  });

  await knex.raw(`
    INSERT INTO categoria_pagamento (usuario_id, nome, ordem)
    SELECT u.id, c.nome, c.ordem
    FROM usuario u CROSS JOIN categoria_pagamento c
    WHERE c.usuario_id IS NULL
  `);
  await knex.raw(`
    UPDATE pagamento p SET categoria_id = copia.id
    FROM categoria_pagamento global, categoria_pagamento copia
    WHERE p.categoria_id = global.id AND global.usuario_id IS NULL
      AND copia.usuario_id = p.usuario_id AND copia.nome = global.nome
  `);
  await knex('categoria_pagamento').whereNull('usuario_id').del();

  await knex.schema.alterTable('categoria_pagamento', (t) => {
    t.uuid('usuario_id').notNullable().alter();
    // Alvo da FK composta de pagamento: garante categoria do mesmo dono.
    t.unique(['id', 'usuario_id']);
  });
  // Nome único por usuário sem diferenciar maiúsculas. Começa por usuario_id: serve às listagens.
  await knex.raw(
    'CREATE UNIQUE INDEX categoria_pagamento_usuario_nome_unique ON categoria_pagamento (usuario_id, lower(nome))',
  );

  await knex.schema.alterTable('pagamento', (t) => {
    t.dropForeign(['categoria_id']);
    t.foreign(['categoria_id', 'usuario_id'])
      .references(['id', 'usuario_id'])
      .inTable('categoria_pagamento');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('pagamento', (t) => {
    t.dropForeign(['categoria_id', 'usuario_id']);
  });
  await knex.raw('DROP INDEX categoria_pagamento_usuario_nome_unique');
  await knex.schema.alterTable('categoria_pagamento', (t) => {
    t.dropUnique(['id', 'usuario_id']);
    t.uuid('usuario_id').nullable().alter();
  });

  // Uma categoria global por nome (a menor ordem entre os usuários).
  await knex.raw(`
    INSERT INTO categoria_pagamento (nome, ordem)
    SELECT nome, MIN(ordem) FROM categoria_pagamento GROUP BY nome
  `);
  await knex.raw(`
    UPDATE pagamento p SET categoria_id = global.id
    FROM categoria_pagamento copia, categoria_pagamento global
    WHERE p.categoria_id = copia.id AND copia.usuario_id IS NOT NULL
      AND global.usuario_id IS NULL AND global.nome = copia.nome
  `);
  await knex('categoria_pagamento').whereNotNull('usuario_id').del();

  await knex.schema.alterTable('categoria_pagamento', (t) => {
    t.dropColumn('usuario_id');
    t.unique(['nome']);
  });
  await knex.schema.alterTable('pagamento', (t) => {
    t.foreign('categoria_id').references('id').inTable('categoria_pagamento');
  });
};
