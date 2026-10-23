// Recebíveis: a origem "outros" ganha a descrição ("Especifique a origem"). Os já cadastrados
// continuam sem ela, então o banco não a exige (o formulário e a API exigem ao salvar); só garante
// que as outras origens não carregam descrição. Decisão 35.
const { check } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.alterTable('recebivel', (t) => {
    t.text('origem_descricao').nullable();
  });
  await check(knex, 'recebivel', 'origem_descricao', "origem = 'outros' OR origem_descricao IS NULL");
};

exports.down = async (knex) => {
  await knex.raw('ALTER TABLE recebivel DROP CONSTRAINT recebivel_origem_descricao_check');
  await knex.schema.alterTable('recebivel', (t) => {
    t.dropColumn('origem_descricao');
  });
};
