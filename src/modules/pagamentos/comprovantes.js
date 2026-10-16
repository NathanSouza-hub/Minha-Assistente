// Comprovantes (foto ou PDF) de uma conta. Mesmas regras dos anexos de viagem (src/lib/anexos.js).
const db = require('../../config/db');
const armazenamento = require('../../lib/armazenamento');
const { conferirArquivo, removerAoConfirmar } = require('../../lib/anexos');
const { AppError, naoEncontrado } = require('../../lib/erros');

const MAXIMO_COMPROVANTES = 5;

const COLUNAS = ['id', 'nomeOriginal', 'mimeType', 'tamanhoBytes', 'criadoEm'];

const doDono = (usuarioId, pagamentoId) =>
  db('pagamento').where({ id: pagamentoId, usuarioId }).first('id');

/** Comprovantes de uma conta, do mais antigo para o mais novo. */
const listar = (conexao, pagamentoId) =>
  conexao('pagamentoComprovante').where({ pagamentoId }).orderBy('criadoEm').select(COLUNAS);

async function adicionar(usuarioId, pagamentoId, arquivo) {
  if (!(await doDono(usuarioId, pagamentoId))) throw naoEncontrado('Pagamento');
  const { tipo, nomeOriginal } = conferirArquivo(arquivo);

  const [{ total }] = await db('pagamentoComprovante').where({ pagamentoId }).count('* as total');
  if (total >= MAXIMO_COMPROVANTES) {
    throw new AppError(409, 'LIMITE_ANEXOS', `Cada conta pode ter no máximo ${MAXIMO_COMPROVANTES} comprovantes.`);
  }

  const caminho = await armazenamento.salvar(arquivo.buffer, tipo.extensao);
  try {
    const [salvo] = await db('pagamentoComprovante')
      .insert({ pagamentoId, nomeOriginal, caminho, mimeType: tipo.mime, tamanhoBytes: arquivo.size })
      .returning(COLUNAS);
    return salvo;
  } catch (erro) {
    await armazenamento.remover(caminho);
    throw erro;
  }
}

const consultar = (usuarioId, pagamentoId, comprovanteId) =>
  db('pagamentoComprovante as c')
    .join('pagamento as p', 'p.id', 'c.pagamentoId')
    .where({ 'c.id': comprovanteId, 'p.id': pagamentoId, 'p.usuarioId': usuarioId })
    .first('c.id', 'c.caminho', 'c.nomeOriginal', 'c.mimeType');

async function abrir(usuarioId, pagamentoId, comprovanteId) {
  const comprovante = await consultar(usuarioId, pagamentoId, comprovanteId);
  if (!comprovante) throw naoEncontrado('Comprovante');
  return { ...comprovante, caminhoAbsoluto: armazenamento.caminhoAbsoluto(comprovante.caminho) };
}

async function remover(usuarioId, pagamentoId, comprovanteId) {
  const comprovante = await consultar(usuarioId, pagamentoId, comprovanteId);
  if (!comprovante) throw naoEncontrado('Comprovante');
  await db('pagamentoComprovante').where({ id: comprovante.id }).del();
  await armazenamento.remover(comprovante.caminho);
}

/**
 * Chame antes de apagar contas: os registros saem em cascata com elas, e os arquivos são
 * apagados quando a transação confirmar.
 */
async function aoApagarContas(trx, pagamentoIds) {
  if (!pagamentoIds.length) return;
  const linhas = await trx('pagamentoComprovante').whereIn('pagamentoId', pagamentoIds).select('caminho');
  removerAoConfirmar(trx, linhas.map((l) => l.caminho));
}

module.exports = { MAXIMO_COMPROVANTES, listar, adicionar, abrir, remover, aoApagarContas };
