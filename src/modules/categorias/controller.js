const service = require('./service');

async function listar(req, res) {
  res.json(await service.listar());
}

module.exports = { listar };
