// Agenda: tipos novos (videoconferência, podcast, gravação, entrevista e "outro") e a descrição do
// tipo "outro", obrigatória nele (também no banco). Os tipos antigos continuam valendo, inclusive
// "video", que deixa de ser oferecido no formulário. Decisão 30.
const { checkIn } = require('../helpers');

const ANTIGOS = ['reuniao_pessoal', 'exame', 'consulta', 'video', 'programa_radio', 'fisioterapia', 'atividade_fisica'];
const NOVOS = ['videoconferencia', 'podcast', 'gravacao', 'entrevista', 'outro'];

exports.up = async (knex) => {
  await knex.schema.alterTable('evento', (t) => {
    t.text('tipo_descricao').nullable();
  });
  await knex.raw('ALTER TABLE evento DROP CONSTRAINT evento_tipo_check');
  await checkIn(knex, 'evento', 'tipo', [...ANTIGOS, ...NOVOS]);
  await knex.raw(`
    ALTER TABLE evento ADD CONSTRAINT evento_tipo_descricao_check
    CHECK (tipo <> 'outro' OR length(btrim(coalesce(tipo_descricao, ''))) > 0)
  `);
};

exports.down = async (knex) => {
  await knex.raw('ALTER TABLE evento DROP CONSTRAINT evento_tipo_descricao_check');
  // Os eventos dos tipos novos voltam para o mais próximo que existia antes.
  await knex('evento').whereIn('tipo', ['videoconferencia', 'podcast', 'gravacao']).update({ tipo: 'video' });
  await knex('evento').whereIn('tipo', ['entrevista', 'outro']).update({ tipo: 'reuniao_pessoal' });
  await knex.raw('ALTER TABLE evento DROP CONSTRAINT evento_tipo_check');
  await checkIn(knex, 'evento', 'tipo', ANTIGOS);
  await knex.schema.alterTable('evento', (t) => {
    t.dropColumn('tipo_descricao');
  });
};
