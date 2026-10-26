// Assistente no WhatsApp, fase 2 (decisão 38): o que foi lançado por mensagem (para o "desfazer")
// e as últimas falas da conversa (para o Claude entender "e o valor é 50" depois de uma pergunta).
// A manutenção apaga as falas de mais de 1 dia e os lançamentos de mais de 30.
const { criarTabela, donoUsuario, checkIn } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'whatsapp_lancamento', (t) => {
    donoUsuario(t);
    t.text('tipo').notNullable();
    // Sem FK: aponta para tabelas diferentes conforme o tipo. Apagar o registro pelo app não
    // apaga a linha daqui; o "desfazer" trata o que já não existe.
    t.uuid('recurso_id').notNullable();
    t.text('resumo').notNullable();
    t.timestamp('desfeito_em', { useTz: true }).nullable();
    t.index(['usuario_id', 'criado_em']);
  });
  await checkIn(knex, 'whatsapp_lancamento', 'tipo', ['pagamento', 'evento', 'tarefa']);

  await criarTabela(knex, 'whatsapp_conversa', (t) => {
    donoUsuario(t);
    t.text('papel').notNullable();
    t.text('texto').notNullable();
    t.index(['usuario_id', 'criado_em']);
  });
  await checkIn(knex, 'whatsapp_conversa', 'papel', ['usuario', 'assistente']);
};

exports.down = async (knex) => {
  await knex.schema.dropTable('whatsapp_conversa');
  await knex.schema.dropTable('whatsapp_lancamento');
};
