// Configuração do Knex compartilhada entre o CLI (knexfile.js) e a aplicação.
// Depende só da URL do banco, para que migrations rodem sem o resto do .env.
const path = require('node:path');
const { paraSnake, chavesParaCamel } = require('../lib/caso');
const { FUSO } = require('../lib/tempo');
const { registrarTiposPg } = require('./pg-tipos');

const RAIZ = path.resolve(__dirname, '../..');

function urlDoBanco() {
  const ehTeste = process.env.NODE_ENV === 'test';
  const url = ehTeste ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
  if (!url) {
    const variavel = ehTeste ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
    throw new Error(`${variavel} não definida. Copie .env.example para .env e preencha.`);
  }
  return url;
}

// Resultado de knex.raw() é o objeto Result do pg; o de query builder é array/objeto.
function posProcessar(resultado) {
  if (resultado && Array.isArray(resultado.rows) && 'command' in resultado) {
    return { ...resultado, rows: chavesParaCamel(resultado.rows) };
  }
  return chavesParaCamel(resultado);
}

function configKnex(url = urlDoBanco()) {
  registrarTiposPg();
  return {
    client: 'pg',
    connection: url,
    pool: {
      min: 0,
      max: 10,
      afterCreate(conexao, pronto) {
        conexao.query(`SET TIME ZONE '${FUSO}'`, (erro) => pronto(erro, conexao));
      },
    },
    migrations: {
      directory: path.join(RAIZ, 'db/migrations'),
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: path.join(RAIZ, 'db/seeds'),
    },
    wrapIdentifier: (valor, original) => original(valor === '*' ? valor : paraSnake(valor)),
    postProcessResponse: posProcessar,
  };
}

module.exports = { configKnex, urlDoBanco };
