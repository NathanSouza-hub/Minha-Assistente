const service = require('./service');

async function painel(req, res) {
  res.json(await service.painel(req.usuario.id, req.validado.query));
}

module.exports = { painel };
