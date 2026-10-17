// Salários e honorários agora ficam na aba "Salários equipe" (migration 19): apaga as categorias
// "Salários" e "Honorários médicos" de quem já tinha conta. As contas que estavam nelas passam
// para "Outros" (criada na migration 16), então nenhuma conta fica sem categoria.

const NOMES = ['salários', 'honorários médicos'];

exports.up = async (knex) => {
  // Quem não tem "Outros" (apagou) ganha de novo, só se tiver conta para mover.
  await knex.raw(
    `
    INSERT INTO categoria_pagamento (usuario_id, nome, ordem)
    SELECT u.id, 'Outros', COALESCE((SELECT MAX(ordem) FROM categoria_pagamento WHERE usuario_id = u.id), 0) + 1
    FROM usuario u
    WHERE NOT EXISTS (
      SELECT 1 FROM categoria_pagamento o WHERE o.usuario_id = u.id AND lower(o.nome) = 'outros'
    )
    AND EXISTS (
      SELECT 1 FROM pagamento p JOIN categoria_pagamento c ON c.id = p.categoria_id
      WHERE c.usuario_id = u.id AND lower(c.nome) = ANY(?)
    )
  `,
    [NOMES],
  );
  await knex.raw(
    `
    UPDATE pagamento p SET categoria_id = outros.id
    FROM categoria_pagamento antiga, categoria_pagamento outros
    WHERE p.categoria_id = antiga.id AND lower(antiga.nome) = ANY(?)
      AND outros.usuario_id = antiga.usuario_id AND lower(outros.nome) = 'outros'
  `,
    [NOMES],
  );
  await knex.raw('DELETE FROM categoria_pagamento WHERE lower(nome) = ANY(?)', [NOMES]);
};

// Não desfaz: as contas movidas para "Outros" não guardam de onde vieram.
exports.down = async () => {};
