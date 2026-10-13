const service = require('./service');

async function cadastrar(req, res) {
  res.status(201).json(await service.cadastrar(req.validado.body));
}

async function entrar(req, res) {
  res.json(await service.entrar(req.validado.body));
}

function eu(req, res) {
  res.json(req.usuario);
}

module.exports = { cadastrar, entrar, eu };
