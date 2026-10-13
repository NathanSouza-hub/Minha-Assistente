const db = require('../../config/db');

const listar = () => db('categoriaPagamento').select('id', 'nome', 'ordem').orderBy('ordem');

module.exports = { listar };
