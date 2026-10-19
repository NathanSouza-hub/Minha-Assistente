const tarefas = require('./tarefas');

async function listar(req, res) {
  res.json(await tarefas.listar(req.usuario.id, req.validado.query));
}

async function marcar(req, res) {
  res.json(await tarefas.marcar(req.usuario.id, req.validado.params.id, req.validado.body));
}

module.exports = { listar, marcar };
