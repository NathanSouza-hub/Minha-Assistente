// Tarefas avulsas (ler e-mails, conferir o banco, ligar para alguém...): título, detalhes, data,
// hora e lembrete opcionais. O "feito" fica na própria tarefa (concluida_em) e o ✗ da tela Hoje em
// tarefa_registro, que ganha a categoria 'tarefa'; os lembretes ganham a origem 'tarefa'. Decisão 28.
const { criarTabela, donoUsuario, checkIn, check } = require('../helpers');

const CATEGORIAS = ['remedio', 'despesa', 'agenda', 'compromisso', 'radio', 'viagem', 'atividade', 'fisioterapia'];
const ORIGENS = ['evento', 'medicamento_horario', 'pagamento', 'rotina', 'resumo'];

async function trocarCheck(knex, tabela, coluna, valores) {
  await knex.raw('ALTER TABLE ?? DROP CONSTRAINT ??', [tabela, `${tabela}_${coluna}_check`]);
  await checkIn(knex, tabela, coluna, valores);
}

exports.up = async (knex) => {
  await criarTabela(knex, 'tarefa', (t) => {
    donoUsuario(t);
    t.text('titulo').notNullable();
    t.text('detalhes').nullable();
    t.date('data').notNullable();
    t.time('hora').nullable();
    t.boolean('lembrete').notNullable().defaultTo(false);
    // Quando foi concluída; nula = pendente. Reabrir apaga.
    t.timestamp('concluida_em', { useTz: true }).nullable();
    t.index(['usuario_id', 'data']);
  });
  await check(knex, 'tarefa', 'lembrete_hora', 'NOT lembrete OR hora IS NOT NULL');

  await trocarCheck(knex, 'tarefa_registro', 'categoria', [...CATEGORIAS, 'tarefa']);
  await trocarCheck(knex, 'lembrete_envio', 'origem_tipo', [...ORIGENS, 'tarefa']);
};

exports.down = async (knex) => {
  await knex('lembrete_envio').where({ origem_tipo: 'tarefa' }).del();
  await trocarCheck(knex, 'lembrete_envio', 'origem_tipo', ORIGENS);
  await knex('tarefa_registro').where({ categoria: 'tarefa' }).del();
  await trocarCheck(knex, 'tarefa_registro', 'categoria', CATEGORIAS);
  await knex.schema.dropTableIfExists('tarefa');
};
