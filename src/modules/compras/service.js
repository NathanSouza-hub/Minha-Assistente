const db = require('../../config/db');
const { naoEncontrado } = require('../../lib/erros');

const COLUNAS = ['id', 'nome', 'categoria', 'quantidade', 'comprado', 'compradoEm', 'criadoEm', 'atualizadoEm'];

// Pendentes primeiro (por categoria e nome); depois os comprados, do mais recente ao mais antigo.
const ORDEM = 'comprado, comprado_em DESC NULLS LAST, categoria NULLS LAST, nome';

const camposGravaveis = (d) => ({ nome: d.nome, categoria: d.categoria, quantidade: d.quantidade });

function listar(usuarioId, { comprado } = {}) {
  const q = db('compraItem').select(COLUNAS).where({ usuarioId }).orderByRaw(ORDEM);
  if (comprado !== undefined) q.where({ comprado });
  return q;
}

async function criar(usuarioId, dados) {
  const [item] = await db('compraItem')
    .insert({ ...camposGravaveis(dados), usuarioId })
    .returning(COLUNAS);
  return item;
}

async function alterar(usuarioId, id, campos) {
  const [item] = await db('compraItem').where({ id, usuarioId }).update(campos).returning(COLUNAS);
  if (!item) throw naoEncontrado('Item');
  return item;
}

const atualizar = (usuarioId, id, dados) => alterar(usuarioId, id, camposGravaveis(dados));

const marcar = (usuarioId, id, { comprado }) =>
  alterar(usuarioId, id, { comprado, compradoEm: comprado ? db.fn.now() : null });

async function remover(usuarioId, id) {
  const apagados = await db('compraItem').where({ id, usuarioId }).del();
  if (!apagados) throw naoEncontrado('Item');
}

module.exports = { listar, criar, atualizar, marcar, remover };
