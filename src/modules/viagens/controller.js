const service = require('./service');
const { naoEncontrado } = require('../../lib/erros');

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

async function adicionarAnexo(req, res) {
  res.status(201).json(await service.adicionarAnexo(req.usuario.id, req.validado.params.id, req.file));
}

// Sempre como download (attachment): o navegador não abre o arquivo dentro da página.
async function baixarAnexo(req, res, next) {
  const { id, anexoId } = req.validado.params;
  const anexo = await service.abrirAnexo(req.usuario.id, id, anexoId);
  res.attachment(anexo.nomeOriginal);
  res.type(anexo.mimeType);
  res.sendFile(anexo.caminhoAbsoluto, (erro) => {
    if (erro && !res.headersSent) next(naoEncontrado('Arquivo'));
  });
}

async function removerAnexo(req, res) {
  const { id, anexoId } = req.validado.params;
  await service.removerAnexo(req.usuario.id, id, anexoId);
  res.status(204).end();
}

module.exports = { listar, buscar, criar, atualizar, remover, adicionarAnexo, baixarAnexo, removerAnexo };
