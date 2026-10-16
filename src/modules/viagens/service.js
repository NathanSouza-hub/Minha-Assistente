const db = require('../../config/db');
const armazenamento = require('../../lib/armazenamento');
const { conferirArquivo } = require('../../lib/anexos');
const { AppError, naoEncontrado } = require('../../lib/erros');

const MAXIMO_ANEXOS = 20;

const COLUNAS = ['id', 'destino', 'ida', 'volta', 'hospedagem', 'transporte', 'observacoes', 'criadoEm', 'atualizadoEm'];
const COLUNAS_ANEXO = ['id', 'viagemId', 'nomeOriginal', 'mimeType', 'tamanhoBytes', 'criadoEm'];

const camposGravaveis = (d) => ({
  destino: d.destino,
  ida: d.ida,
  volta: d.volta,
  hospedagem: d.hospedagem,
  transporte: d.transporte,
  observacoes: d.observacoes,
});

const publicoAnexo = (a) => ({
  id: a.id,
  nomeOriginal: a.nomeOriginal,
  mimeType: a.mimeType,
  tamanhoBytes: a.tamanhoBytes,
  criadoEm: a.criadoEm,
});

async function comAnexos(conexao, viagens) {
  if (!viagens.length) return [];
  const anexos = await conexao('viagemAnexo')
    .select(COLUNAS_ANEXO)
    .whereIn(
      'viagemId',
      viagens.map((v) => v.id),
    )
    .orderBy('criadoEm');
  return viagens.map((v) => ({
    ...v,
    anexos: anexos.filter((a) => a.viagemId === v.id).map(publicoAnexo),
  }));
}

// Mais recentes (ou próximas) primeiro.
async function listar(usuarioId) {
  const viagens = await db('viagem').select(COLUNAS).where({ usuarioId }).orderBy('ida', 'desc');
  return comAnexos(db, viagens);
}

async function buscar(usuarioId, id, conexao = db) {
  const viagem = await conexao('viagem').select(COLUNAS).where({ id, usuarioId }).first();
  if (!viagem) throw naoEncontrado('Viagem', { feminino: true });
  const [completa] = await comAnexos(conexao, [viagem]);
  return completa;
}

async function criar(usuarioId, dados) {
  const [{ id }] = await db('viagem')
    .insert({ ...camposGravaveis(dados), usuarioId })
    .returning('id');
  return buscar(usuarioId, id);
}

async function atualizar(usuarioId, id, dados) {
  const alterados = await db('viagem').where({ id, usuarioId }).update(camposGravaveis(dados));
  if (!alterados) throw naoEncontrado('Viagem', { feminino: true });
  return buscar(usuarioId, id);
}

async function remover(usuarioId, id) {
  const arquivos = await db('viagemAnexo as a')
    .join('viagem as v', 'v.id', 'a.viagemId')
    .where({ 'v.id': id, 'v.usuarioId': usuarioId })
    .pluck('a.caminho');
  const apagados = await db('viagem').where({ id, usuarioId }).del();
  if (!apagados) throw naoEncontrado('Viagem', { feminino: true });
  // Os registros dos anexos saem em cascata; os arquivos são apagados depois do banco.
  await Promise.all(arquivos.map((caminho) => armazenamento.remover(caminho)));
}

async function adicionarAnexo(usuarioId, viagemId, arquivo) {
  await buscar(usuarioId, viagemId);
  const { tipo, nomeOriginal } = conferirArquivo(arquivo);

  const [{ total }] = await db('viagemAnexo').where({ viagemId }).count('* as total');
  if (total >= MAXIMO_ANEXOS) {
    throw new AppError(409, 'LIMITE_ANEXOS', `Cada viagem pode ter no máximo ${MAXIMO_ANEXOS} anexos.`);
  }

  const caminho = await armazenamento.salvar(arquivo.buffer, tipo.extensao);
  try {
    const [anexo] = await db('viagemAnexo')
      .insert({
        viagemId,
        nomeOriginal,
        caminho,
        mimeType: tipo.mime,
        tamanhoBytes: arquivo.size,
      })
      .returning(COLUNAS_ANEXO);
    return publicoAnexo(anexo);
  } catch (erro) {
    await armazenamento.remover(caminho);
    throw erro;
  }
}

const consultaAnexo = (usuarioId, viagemId, anexoId) =>
  db('viagemAnexo as a')
    .join('viagem as v', 'v.id', 'a.viagemId')
    .where({ 'a.id': anexoId, 'v.id': viagemId, 'v.usuarioId': usuarioId })
    .first('a.id', 'a.caminho', 'a.nomeOriginal', 'a.mimeType');

async function abrirAnexo(usuarioId, viagemId, anexoId) {
  const anexo = await consultaAnexo(usuarioId, viagemId, anexoId);
  if (!anexo) throw naoEncontrado('Anexo');
  return { ...anexo, caminhoAbsoluto: armazenamento.caminhoAbsoluto(anexo.caminho) };
}

async function removerAnexo(usuarioId, viagemId, anexoId) {
  const anexo = await consultaAnexo(usuarioId, viagemId, anexoId);
  if (!anexo) throw naoEncontrado('Anexo');
  await db('viagemAnexo').where({ id: anexo.id }).del();
  await armazenamento.remover(anexo.caminho);
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  remover,
  adicionarAnexo,
  abrirAnexo,
  removerAnexo,
  MAXIMO_ANEXOS,
};
