// Assistente do WhatsApp, ajustes de 2026-10-29 (decisão 38):
// - categorias padrão novas (Alimentação, Transporte, Saúde, Casa, Contas fixas, Lazer) para quem
//   já tem conta; só entram as que a pessoa ainda não tem (sem diferenciar maiúsculas), no fim da lista;
// - o "desfazer" passa a alcançar compra no cartão e pagamento da equipe (`dados` guarda o que
//   precisa para voltar atrás ou relançar noutra categoria);
// - lançamento acima do limite espera o "SIM" da pessoa em whatsapp_pendente.
const { criarTabela, donoUsuario, checkIn } = require('../helpers');

const NOVAS = ['Alimentação', 'Transporte', 'Saúde', 'Casa', 'Contas fixas', 'Lazer'];

exports.up = async (knex) => {
  await knex.raw(
    `INSERT INTO categoria_pagamento (usuario_id, nome, ordem)
     SELECT u.id, n.nome, COALESCE(m.maior, 0) + n.posicao
     FROM usuario u
     CROSS JOIN unnest(?::text[]) WITH ORDINALITY AS n(nome, posicao)
     LEFT JOIN LATERAL (SELECT MAX(ordem) AS maior FROM categoria_pagamento c WHERE c.usuario_id = u.id) m ON true
     WHERE NOT EXISTS (
       SELECT 1 FROM categoria_pagamento c WHERE c.usuario_id = u.id AND lower(c.nome) = lower(n.nome)
     )`,
    [NOVAS],
  );

  await knex.schema.alterTable('whatsapp_lancamento', (t) => {
    t.jsonb('dados').nullable();
  });
  await knex.raw('ALTER TABLE whatsapp_lancamento DROP CONSTRAINT whatsapp_lancamento_tipo_check');
  await checkIn(knex, 'whatsapp_lancamento', 'tipo', ['pagamento', 'evento', 'tarefa', 'compra_cartao', 'pagamento_equipe']);

  await criarTabela(knex, 'whatsapp_pendente', (t) => {
    donoUsuario(t);
    t.text('ferramenta').notNullable();
    t.jsonb('entrada').notNullable();
    t.text('pergunta').notNullable();
    t.index(['usuario_id', 'criado_em']);
  });
  await checkIn(knex, 'whatsapp_pendente', 'ferramenta', ['lancar_conta', 'pagar_equipe']);
};

exports.down = async (knex) => {
  await knex.schema.dropTable('whatsapp_pendente');
  await knex('whatsapp_lancamento').whereIn('tipo', ['compra_cartao', 'pagamento_equipe']).del();
  await knex.raw('ALTER TABLE whatsapp_lancamento DROP CONSTRAINT whatsapp_lancamento_tipo_check');
  await checkIn(knex, 'whatsapp_lancamento', 'tipo', ['pagamento', 'evento', 'tarefa']);
  await knex.schema.alterTable('whatsapp_lancamento', (t) => {
    t.dropColumn('dados');
  });
  // As categorias acrescentadas ficam: podem já ter contas.
};
