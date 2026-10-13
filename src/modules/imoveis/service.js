const db = require('../../config/db');
const { AppError, naoEncontrado } = require('../../lib/erros');

const CAMPOS = ['id', 'nome', 'ordem'];

const duplicado = () => new AppError(409, 'IMOVEL_DUPLICADO', 'Você já tem um imóvel com esse nome.');

const listar = (usuarioId) =>
  db('imovel').select(CAMPOS).where({ usuarioId }).orderBy([{ column: 'ordem' }, { column: 'nome' }]);

async function criar(usuarioId, { nome, ordem = 0 }) {
  try {
    const [imovel] = await db('imovel').insert({ usuarioId, nome, ordem }).returning(CAMPOS);
    return imovel;
  } catch (erro) {
    if (erro.code === '23505') throw duplicado();
    throw erro;
  }
}

async function atualizar(usuarioId, id, { nome, ordem }) {
  try {
    const [imovel] = await db('imovel')
      .where({ id, usuarioId })
      .update({ nome, ...(ordem !== undefined && { ordem }) })
      .returning(CAMPOS);
    if (!imovel) throw naoEncontrado('Imóvel');
    return imovel;
  } catch (erro) {
    if (erro.code === '23505') throw duplicado();
    throw erro;
  }
}

async function remover(usuarioId, id) {
  try {
    const apagados = await db('imovel').where({ id, usuarioId }).del();
    if (!apagados) throw naoEncontrado('Imóvel');
  } catch (erro) {
    if (erro.code === '23503') {
      throw new AppError(
        409,
        'REFERENCIA_INVALIDA',
        'Este imóvel tem pagamentos ligados. Remova os pagamentos ou troque o imóvel deles antes.',
      );
    }
    throw erro;
  }
}

module.exports = { listar, criar, atualizar, remover };
