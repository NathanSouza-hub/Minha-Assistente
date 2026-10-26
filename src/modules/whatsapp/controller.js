const service = require('./service');

async function situacao(req, res) {
  res.json(await service.situacao(req.usuario.id));
}

async function gerarCodigo(req, res) {
  res.status(201).json(await service.gerarCodigo(req.usuario.id));
}

async function desvincular(req, res) {
  await service.desvincular(req.usuario.id);
  res.status(204).end();
}

module.exports = { situacao, gerarCodigo, desvincular };
