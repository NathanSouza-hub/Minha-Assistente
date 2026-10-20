// Prepara o banco de teste do zero: cria se não existir, desfaz e refaz as migrations. Não há seed:
// as categorias padrão nascem no cadastro de cada usuário.
const knex = require('knex');

function nomeDoBanco(url) {
  return new URL(url).pathname.replace(/^\//, '');
}

function garantirBancoDeTesteSeparado() {
  const teste = process.env.DATABASE_URL_TEST;
  if (!teste) throw new Error('Defina DATABASE_URL_TEST no .env para rodar os testes.');
  const nome = nomeDoBanco(teste);
  if (!nome.includes('test')) {
    throw new Error(`Por segurança, o banco de teste precisa ter "test" no nome (atual: ${nome}).`);
  }
  if (process.env.DATABASE_URL && nomeDoBanco(process.env.DATABASE_URL) === nome) {
    throw new Error('DATABASE_URL_TEST aponta para o mesmo banco de DATABASE_URL.');
  }
  return { url: teste, nome };
}

async function criarBancoSeNaoExistir() {
  const { url, nome } = garantirBancoDeTesteSeparado();
  const urlAdmin = new URL(url);
  urlAdmin.pathname = '/postgres';
  const admin = knex({ client: 'pg', connection: urlAdmin.toString() });
  try {
    const { rows } = await admin.raw('select 1 from pg_database where datname = ?', [nome]);
    if (rows.length === 0) await admin.raw('create database ??', [nome]);
  } finally {
    await admin.destroy();
  }
}

async function prepararBanco(db) {
  await criarBancoSeNaoExistir();
  // Apaga os dados antes de desfazer: o "down" das migrations antigas volta colunas de dinheiro para
  // integer, e um valor grande deixado pelo arquivo de teste anterior faria a volta falhar.
  // Todo dado pertence a um usuário (ON DELETE CASCADE), então TRUNCATE usuario leva tudo.
  if (await db.schema.hasTable('usuario')) await db.raw('TRUNCATE usuario CASCADE');
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
}

module.exports = { prepararBanco, criarBancoSeNaoExistir };
