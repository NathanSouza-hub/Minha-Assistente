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

module.exports = { chavePublica, inscrever, cancelar, testar };
