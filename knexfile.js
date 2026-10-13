require('dotenv').config({ quiet: true });
const { configKnex } = require('./src/config/database');

module.exports = configKnex();
