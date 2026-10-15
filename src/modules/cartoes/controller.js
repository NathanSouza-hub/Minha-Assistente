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

async function fatura(req, res) {
  const { id, competencia } = req.validado.params;
  res.json(await service.fatura(req.usuario.id, id, competencia));
}

async function buscarCompra(req, res) {
  const { id, compraId } = req.validado.params;
  res.json(await service.buscarCompra(req.usuario.id, id, compraId));
}

async function criarCompra(req, res) {
  res.status(201).json(await service.criarCompra(req.usuario.id, req.validado.params.id, req.validado.body));
}

async function atualizarCompra(req, res) {
  const { id, compraId } = req.validado.params;
  res.json(await service.atualizarCompra(req.usuario.id, id, compraId, req.validado.body));
}

async function removerCompra(req, res) {
  const { id, compraId } = req.validado.params;
  await service.removerCompra(req.usuario.id, id, compraId);
  res.status(204).end();
}

module.exports = { listar, buscar, criar, atualizar, remover, fatura, buscarCompra, criarCompra, atualizarCompra, removerCompra };
