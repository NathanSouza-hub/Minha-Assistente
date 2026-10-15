const db = require('../../config/db');
const { AppError, naoEncontrado } = require('../../lib/erros');

const CAMPOS = ['id', 'nome', 'ordem'];

const duplicada = () =>
  new AppError(409, 'CATEGORIA_DUPLICADA', 'Você já tem uma categoria com esse nome.');

const listar = (usuarioId) =>
  db('categoriaPagamento')
    .select(CAMPOS)
    .where({ usuarioId })
    .orderBy([{ column: 'ordem' }, { column: 'nome' }]);

async function comDuplicada(operacao) {
  try {
    return await operacao();
  } catch (erro) {
    if (erro.code === '23505') throw duplicada();
    throw erro;
  }
}

// Sem ordem, a categoria nova vai para o fim da lista.
const criar = (usuarioId, { nome, ordem }) =>
  comDuplicada(async () => {
    const [categoria] = await db('categoriaPagamento')
      .insert({
        usuarioId,
        nome,
        ordem:
          ordem ??
          db('categoriaPagamento').where({ usuarioId }).select(db.raw('COALESCE(MAX(ordem), 0) + 1')),
      })
      .returning(CAMPOS);
    return categoria;
  });

const atualizar = (usuarioId, id, { nome, ordem }) =>
  comDuplicada(async () => {
    const [categoria] = await db('categoriaPagamento')
      .where({ id, usuarioId })
      .update({ nome, ...(ordem !== undefined && { ordem }) })
      .returning(CAMPOS);
    if (!categoria) throw naoEncontrado('Categoria');
    return categoria;
  });

async function remover(usuarioId, id) {
  try {
    const apagadas = await db('categoriaPagamento').where({ id, usuarioId }).del();
    if (!apagadas) throw naoEncontrado('Categoria');
  } catch (erro) {
    if (erro.code === '23503') {
      throw new AppError(
        409,
        'REFERENCIA_INVALIDA',
        'Esta categoria tem contas. Mude a categoria dessas contas antes de apagar.',
      );
    }
    throw erro;
  }
}

module.exports = { listar, criar, atualizar, remover };
