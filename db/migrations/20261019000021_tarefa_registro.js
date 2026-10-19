// Tarefas do dia (tela Hoje): o ✓/✗ de cada ocorrência, sem mexer nas tabelas dos módulos.
// Remédio, compromisso e despesa guardam o "feito" no próprio módulo (medicamento_registro,
// rotina_conclusao, pagamento pago); aqui ficam o "não feito" deles e os dois estados dos outros.
// Sem linha = pendente. item_id não tem FK: aponta para tabelas diferentes conforme a categoria.
const { criarTabela, checkIn, donoUsuario } = require('../helpers');

exports.up = async (knex) => {
  await criarTabela(knex, 'tarefa_registro', (t) => {
    donoUsuario(t);
    t.text('categoria').notNullable();
    t.uuid('item_id').notNullable();
    t.date('data_ocorrencia').notNullable();
    t.time('horario').nullable();
    t.text('status').notNullable();
  });

  await checkIn(knex, 'tarefa_registro', 'categoria', [
    'remedio',
    'despesa',
    'agenda',
    'compromisso',
    'radio',
    'viagem',
    'atividade',
    'fisioterapia',
  ]);
  await checkIn(knex, 'tarefa_registro', 'status', ['feito', 'nao_feito']);
  // Item sem horário (dia todo) também é único no dia: NULLS NOT DISTINCT.
  await knex.raw(`
    ALTER TABLE tarefa_registro ADD CONSTRAINT tarefa_registro_ocorrencia_unique
    UNIQUE NULLS NOT DISTINCT (usuario_id, categoria, item_id, data_ocorrencia, horario)
  `);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('tarefa_registro');
};
