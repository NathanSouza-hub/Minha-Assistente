// Cria ou atualiza a usuária a partir do .env. Rodar de novo redefine nome e senha.
const bcrypt = require('bcryptjs');

const CUSTO_BCRYPT = 12;

exports.seed = async (knex) => {
  const { SEED_USUARIA_NOME, SEED_USUARIA_EMAIL, SEED_USUARIA_SENHA } = process.env;

  if (!SEED_USUARIA_EMAIL || !SEED_USUARIA_SENHA) {
    throw new Error('Defina SEED_USUARIA_EMAIL e SEED_USUARIA_SENHA no .env para criar a usuária.');
  }
  if (SEED_USUARIA_SENHA.length < 8) {
    throw new Error('SEED_USUARIA_SENHA precisa ter pelo menos 8 caracteres.');
  }

  const senhaHash = await bcrypt.hash(SEED_USUARIA_SENHA, CUSTO_BCRYPT);

  await knex('usuario')
    .insert({
      nome: SEED_USUARIA_NOME || 'Débora',
      email: SEED_USUARIA_EMAIL.trim(),
      senhaHash,
    })
    .onConflict('email')
    .merge(['nome', 'senhaHash']);
};
