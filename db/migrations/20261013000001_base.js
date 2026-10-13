// Extensões e função de trigger usadas pelas demais tabelas.

exports.up = async (knex) => {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS citext');
  await knex.raw(`
    CREATE OR REPLACE FUNCTION definir_atualizado_em() RETURNS trigger AS $$
    BEGIN
      NEW.atualizado_em = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
};

exports.down = async (knex) => {
  await knex.raw('DROP FUNCTION IF EXISTS definir_atualizado_em()');
  // citext fica: outras bases/objetos podem depender dela.
};
