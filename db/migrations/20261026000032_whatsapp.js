// WhatsApp (decisão 38): o número de cada usuário, ligado por um código de 6 dígitos que ele manda
// para o número do app; e as mensagens já recebidas, porque a Meta reenvia o webhook quando a
// resposta demora ou falha.
const { criarTabela, donoUsuario, check } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'whatsapp_vinculo', (t) => {
    donoUsuario(t);
    t.unique(['usuario_id']);
    // Como a Meta manda em "from" (só dígitos, com o país). Um número só fala por uma conta.
    t.text('telefone').nullable().unique();
    t.timestamp('vinculado_em', { useTz: true }).nullable();
    // sha256 do código pendente; nulo depois de usado.
    t.text('codigo_hash').nullable().unique();
    t.timestamp('codigo_expira_em', { useTz: true }).nullable();
  });
  await check(knex, 'whatsapp_vinculo', 'telefone', "telefone IS NULL OR (telefone ~ '^[0-9]{8,15}$' AND vinculado_em IS NOT NULL)");
  await check(knex, 'whatsapp_vinculo', 'codigo', '(codigo_hash IS NULL) = (codigo_expira_em IS NULL)');

  // Sem usuario_id: chega mensagem de quem ainda não tem número ligado. A manutenção apaga as antigas.
  await knex.schema.createTable('whatsapp_mensagem', (t) => {
    t.text('id').primary(); // wamid da Meta
    t.timestamp('recebida_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['recebida_em']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTable('whatsapp_mensagem');
  await knex.schema.dropTable('whatsapp_vinculo');
};
