// "Consultas", "Exames" e "Parcelamentos" deixam de ser abas do Cadastro de despesas: apaga essas
// categorias de todos. As contas e as compras de cartão que estavam nelas passam para "Outros"
// (criada se a pessoa tiver apagado a dela e tiver algo para mover). Parcelar uma conta continua
// igual: não depende de categoria.

const NOMES = ['consultas', 'exames', 'parcelamentos'];

exports.up = async (knex) => {
  await knex.raw(
    `
    INSERT INTO categoria_pagamento (usuario_id, nome, ordem)
    SELECT u.id, 'Outros', COALESCE((SELECT MAX(ordem) FROM categoria_pagamento WHERE usuario_id = u.id), 0) + 1
    FROM usuario u
    WHERE NOT EXISTS (
      SELECT 1 FROM categoria_pagamento o WHERE o.usuario_id = u.id AND lower(o.nome) = 'outros'
    )
    AND EXISTS (
      SELECT 1 FROM categoria_pagamento c
      WHERE c.usuario_id = u.id AND lower(c.nome) = ANY(?)
        AND (EXISTS (SELECT 1 FROM pagamento p WHERE p.categoria_id = c.id)
          OR EXISTS (SELECT 1 FROM cartao_compra k WHERE k.categoria_id = c.id))
    )
  `,
    [NOMES],
  );
  // A compra de cartão também aponta para a categoria (sem ON DELETE): precisa sair antes.
  for (const tabela of ['pagamento', 'cartao_compra']) {
    await knex.raw(
      `
      UPDATE ${tabela} t SET categoria_id = outros.id
      FROM categoria_pagamento antiga, categoria_pagamento outros
      WHERE t.categoria_id = antiga.id AND lower(antiga.nome) = ANY(?)
        AND outros.usuario_id = antiga.usuario_id AND lower(outros.nome) = 'outros'
    `,
      [NOMES],
    );
  }
  await knex.raw('DELETE FROM categoria_pagamento WHERE lower(nome) = ANY(?)', [NOMES]);
};

// Não desfaz: as contas movidas para "Outros" não guardam de onde vieram.
exports.down = async () => {};
