// Categoria "Outros" para o que não se encaixa nas demais (e para o assistente do WhatsApp lançar
// o que não identificar). Entra no fim da lista de quem ainda não tem uma com esse nome; contas
// novas já nascem com ela (src/modules/categorias/padrao.js).

exports.up = async (knex) => {
  await knex.raw(`
    INSERT INTO categoria_pagamento (usuario_id, nome, ordem)
    SELECT u.id, 'Outros', COALESCE(MAX(c.ordem), 0) + 1
    FROM usuario u
    LEFT JOIN categoria_pagamento c ON c.usuario_id = u.id
    WHERE NOT EXISTS (
      SELECT 1 FROM categoria_pagamento o WHERE o.usuario_id = u.id AND lower(o.nome) = 'outros'
    )
    GROUP BY u.id
  `);
};

// Não desfaz: a categoria pode já ter contas, e apagá-la perderia a classificação delas.
exports.down = async () => {};
