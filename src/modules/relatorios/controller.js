const service = require('./service');

async function gastos(req, res) {
  res.json(await service.gastos(req.usuario.id, req.validado.query));
}

module.exports = { gastos };
