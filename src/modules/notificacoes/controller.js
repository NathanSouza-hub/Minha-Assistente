const service = require('./service');

function chavePublica(req, res) {
  res.json(service.chavePublica());
}

async function inscrever(req, res) {
  res.status(201).json(await service.inscrever(req.usuario.id, req.validado.body, req.get('user-agent')));
}

async function cancelar(req, res) {
  await service.cancelar(req.usuario.id, req.validado.body);
  res.status(204).end();
}

async function testar(req, res) {
  await service.testar(req.usuario.id);
  res.status(204).end();
}

async function lerResumo(req, res) {
  res.json(await service.lerResumo(req.usuario.id));
}

async function salvarResumo(req, res) {
  res.json(await service.salvarResumo(req.usuario.id, req.validado.body));
}

async function lerAvisos(req, res) {
  res.json(await service.lerAvisos(req.usuario.id));
}

async function salvarAvisos(req, res) {
  res.json(await service.salvarAvisos(req.usuario.id, req.validado.body));
}

module.exports = { chavePublica, inscrever, cancelar, testar, lerResumo, salvarResumo, lerAvisos, salvarAvisos };
