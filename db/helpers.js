// Auxiliares das migrations. Ficam fora de db/migrations para o Knex não tratá-los como migration.
// Os valores aceitos em cada CHECK ficam escritos na própria migration (histórico imutável).

const listaSql = (valores) => valores.map((v) => `'${v}'`).join(', ');

// "Enum" como text + CHECK com nome previsível: <tabela>_<coluna>_check.
async function checkIn(knex, tabela, coluna, valores) {
  await knex.raw(`ALTER TABLE ?? ADD CONSTRAINT ?? CHECK (?? IN (${listaSql(valores)}))`, [
    tabela,
    `${tabela}_${coluna}_check`,
    coluna,
  ]);
}

async function check(knex, tabela, nome, expressao) {
  await knex.raw(`ALTER TABLE ?? ADD CONSTRAINT ?? CHECK (${expressao})`, [
    tabela,
    `${tabela}_${nome}_check`,
  ]);
}

function idUuid(knex, t) {
  t.uuid('id').primary().defaultTo(knex.fn.uuid());
}

// Dono do registro. Apagar o usuário apaga os dados dele.
function donoUsuario(t) {
  t.uuid('usuario_id').notNullable().references('id').inTable('usuario').onDelete('CASCADE');
}

function carimbos(knex, t) {
  t.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  t.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
}

async function triggerAtualizadoEm(knex, tabela) {
  await knex.raw(
    'CREATE TRIGGER ?? BEFORE UPDATE ON ?? FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em()',
    [`${tabela}_atualizado_em`, tabela],
  );
}

// Cria a tabela com id, colunas, carimbos e trigger de atualizado_em.
async function criarTabela(knex, tabela, colunas) {
  await knex.schema.createTable(tabela, (t) => {
    idUuid(knex, t);
    colunas(t);
    carimbos(knex, t);
  });
  await triggerAtualizadoEm(knex, tabela);
}

module.exports = { checkIn, check, idUuid, donoUsuario, carimbos, triggerAtualizadoEm, criarTabela };
