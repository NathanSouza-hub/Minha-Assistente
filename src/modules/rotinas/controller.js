const service = require('./service');

async function listar(req, res) {
  res.json(await service.listar(req.usuario.id));
}

async function criar(req, res) {
  res.status(201).json(await service.criar(req.usuario.id, req.validado.body));
}

async function atualizar(req, res) {
  res.json(await service.atualizar(req.usuario.id, req.validado.params.id, req.validado.body));
}

async function remover(req, res) {
  await service.remover(req.usuario.id, req.validado.params.id);
  res.status(204).end();
}

async function doDia(req, res) {
  res.json(await service.doDia(req.usuario.id, req.validado.query));
}

async function concluir(req, res) {
  res.json(await service.concluir(req.usuario.id, req.validado.params.id, req.validado.body));
}

async function historico(req, res) {
  res.json(await service.historico(req.usuario.id, req.validado.params.id, req.validado.query));
}

module.exports = { listar, criar, atualizar, remover, doDia, concluir, historico };
