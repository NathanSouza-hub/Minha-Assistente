// Comprovantes (foto ou PDF) de um registro financeiro: contas (`pagamento_comprovante`) e
// recebíveis (`recebivel_comprovante`). Mesmas regras dos anexos de viagem (src/lib/anexos.js).
const db = require('../config/db');
const armazenamento = require('./armazenamento');
const { conferirArquivo, removerAoConfirmar } = require('./anexos');
const { AppError, naoEncontrado } = require('./erros');

const MAXIMO_COMPROVANTES = 5;

const COLUNAS = ['id', 'nomeOriginal', 'mimeType', 'tamanhoBytes', 'criadoEm'];

/**
 * @param tabela tabela dos comprovantes (camelCase), ex.: 'pagamentoComprovante'
 * @param pai tabela do registro dono (tem `usuario_id`), ex.: 'pagamento'
 * @param chave coluna que aponta para o pai, ex.: 'pagamentoId'
 * @param recurso nome no 404, ex.: 'Pagamento'
 * @param registro como o limite chama o registro, ex.: 'conta'
 */
function criarComprovantes({ tabela, pai, chave, recurso, registro }) {
  const doDono = (usuarioId, paiId) => db(pai).where({ id: paiId, usuarioId }).first('id');

  /** Comprovantes de um registro, do mais antigo para o mais novo. */
  const listar = (conexao, paiId) => conexao(tabela).where({ [chave]: paiId }).orderBy('criadoEm').select(COLUNAS);

  async function adicionar(usuarioId, paiId, arquivo) {
    if (!(await doDono(usuarioId, paiId))) throw naoEncontrado(recurso);
    const { tipo, nomeOriginal } = conferirArquivo(arquivo);

    const [{ total }] = await db(tabela).where({ [chave]: paiId }).count('* as total');
    if (total >= MAXIMO_COMPROVANTES) {
      throw new AppError(
        409,
        'LIMITE_ANEXOS',
        `Cada ${registro} pode ter no máximo ${MAXIMO_COMPROVANTES} comprovantes.`,
      );
    }

    const caminho = await armazenamento.salvar(arquivo.buffer, tipo.extensao);
    try {
      const [salvo] = await db(tabela)
        .insert({ [chave]: paiId, nomeOriginal, caminho, mimeType: tipo.mime, tamanhoBytes: arquivo.size })
        .returning(COLUNAS);
      return salvo;
    } catch (erro) {
      await armazenamento.remover(caminho);
      throw erro;
    }
  }

  const consultar = (usuarioId, paiId, comprovanteId) =>
    db(`${tabela} as c`)
      .join(`${pai} as p`, 'p.id', `c.${chave}`)
      .where({ 'c.id': comprovanteId, 'p.id': paiId, 'p.usuarioId': usuarioId })
      .first('c.id', 'c.caminho', 'c.nomeOriginal', 'c.mimeType');

  async function abrir(usuarioId, paiId, comprovanteId) {
    const comprovante = await consultar(usuarioId, paiId, comprovanteId);
    if (!comprovante) throw naoEncontrado('Comprovante');
    return { ...comprovante, caminhoAbsoluto: armazenamento.caminhoAbsoluto(comprovante.caminho) };
  }

  async function remover(usuarioId, paiId, comprovanteId) {
    const comprovante = await consultar(usuarioId, paiId, comprovanteId);
    if (!comprovante) throw naoEncontrado('Comprovante');
    await db(tabela).where({ id: comprovante.id }).del();
    await armazenamento.remover(comprovante.caminho);
  }

  /**
   * Chame antes de apagar registros: os comprovantes saem em cascata com eles, e os arquivos são
   * apagados quando a transação confirmar.
   */
  async function aoApagar(trx, paiIds) {
    if (!paiIds.length) return;
    const linhas = await trx(tabela).whereIn(chave, paiIds).select('caminho');
    removerAoConfirmar(trx, linhas.map((l) => l.caminho));
  }

  return { listar, adicionar, abrir, remover, aoApagar };
}

module.exports = { MAXIMO_COMPROVANTES, criarComprovantes };
