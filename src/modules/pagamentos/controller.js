const service = require('./service');
const comprovantes = require('./comprovantes');
const db = require('../../config/db');
const { naoEncontrado } = require('../../lib/erros');

async function listar(req, res) {
  res.json(await service.listar(req.usuario.id, req.validado.query));
}

async function buscar(req, res) {
  const pagamento = await service.buscar(req.usuario.id, req.validado.params.id);
  res.json({ ...pagamento, comprovantes: await comprovantes.listar(db, pagamento.id) });
}

async function criar(req, res) {
  res.status(201).json(await service.criar(req.usuario.id, req.validado.body));
}

async function atualizar(req, res) {
  res.json(await service.atualizar(req.usuario.id, req.validado.params.id, req.validado.body));
}

async function pagar(req, res) {
  res.json(await service.pagar(req.usuario.id, req.validado.params.id, req.validado.body));
}

async function remover(req, res) {
  await service.remover(req.usuario.id, req.validado.params.id);
  res.status(204).end();
}

async function adicionarComprovante(req, res) {
  res.status(201).json(await comprovantes.adicionar(req.usuario.id, req.validado.params.id, req.file));
}

async function baixarComprovante(req, res, next) {
  const { id, comprovanteId } = req.validado.params;
  const comprovante = await comprovantes.abrir(req.usuario.id, id, comprovanteId);
  res.attachment(comprovante.nomeOriginal);
  res.type(comprovante.mimeType);
  res.sendFile(comprovante.caminhoAbsoluto, (erro) => {
    if (erro && !res.headersSent) next(naoEncontrado('Arquivo'));
  });
}

async function removerComprovante(req, res) {
  const { id, comprovanteId } = req.validado.params;
  await comprovantes.remover(req.usuario.id, id, comprovanteId);
  res.status(204).end();
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  pagar,
  remover,
  adicionarComprovante,
  baixarComprovante,
  removerComprovante,
};
