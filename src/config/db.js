// Instância única do Knex usada pela aplicação.
require('dotenv').config({ quiet: true });
const knex = require('knex');
const { configKnex } = require('./database');

module.exports = knex(configKnex());
