const { criarTabela, checkIn, donoUsuario } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'lembrete_envio', (t) => {
    // Destinatário: o canal usa para achar as inscrições push (ou o telefone, no futuro).
    donoUsuario(t);
    t.text('origem_tipo').notNullable();
    // Polimórfico (evento, medicamento_horario, pagamento, rotina): sem FK de propósito.
    t.uuid('origem_id').notNullable();
    // Qual ocorrência da origem este lembrete avisa (eventos e medicamentos se repetem).
    t.timestamp('ocorrencia', { useTz: true }).notNullable();
    t.text('canal').notNullable();
    t.timestamp('agendado_para', { useTz: true }).notNullable();
    t.timestamp('enviado_em', { useTz: true }).nullable();
    t.text('status').notNullable().defaultTo('pendente');
    t.smallint('tentativas').notNullable().defaultTo(0);
    t.text('erro').nullable();

    t.unique(['origem_tipo', 'origem_id', 'ocorrencia', 'canal']);
    t.index(['status', 'agendado_para']);
    t.index(['origem_tipo', 'origem_id']);
  });

  await checkIn(knex, 'lembrete_envio', 'origem_tipo', [
    'evento',
    'medicamento_horario',
    'pagamento',
    'rotina',
  ]);
  // Para adicionar o WhatsApp: nova migration trocando este CHECK por ('app', 'whatsapp').
  await checkIn(knex, 'lembrete_envio', 'canal', ['app']);
  await checkIn(knex, 'lembrete_envio', 'status', ['pendente', 'enviado', 'falhou', 'cancelado']);

  // endpoint é único por navegador; se outro usuário logar no mesmo aparelho, a inscrição passa a ele.
  await criarTabela(knex, 'push_inscricao', (t) => {
    donoUsuario(t);
    t.index(['usuario_id']);
    t.text('endpoint').notNullable().unique();
    t.text('p256dh').notNullable();
    t.text('auth').notNullable();
    t.text('user_agent').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('push_inscricao');
  await knex.schema.dropTableIfExists('lembrete_envio');
};
