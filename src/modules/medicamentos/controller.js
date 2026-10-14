const service = require('./service');

async function listar(req, res) {
  res.json(await service.listar(req.usuario.id));
}

async function buscar(req, res) {
  res.json(await service.buscar(req.usuario.id, req.validado.params.id));
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

async function registrar(req, res) {
  res.json(await service.registrar(req.usuario.id, req.validado.body));
}

module.exports = { listar, buscar, criar, atualizar, remover, doDia, registrar };
