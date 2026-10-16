// Regras comuns aos arquivos enviados (anexos de viagem, comprovantes de conta).
const path = require('node:path');
const armazenamento = require('./armazenamento');
const { detectarTipo, DESCRICAO_TIPOS_ACEITOS } = require('./tipoArquivo');
const { AppError, requisicaoInvalida } = require('./erros');

// Nome exibido no download: sem pastas, sem caracteres de controle, com tamanho limitado.
function nomeSeguro(original, extensao) {
  const nome = path.basename(original ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  return nome || `anexo${extensao}`;
}

/**
 * Confere o arquivo do upload (req.file) e devolve o tipo detectado pelo conteúdo e o nome a
 * guardar. Sem arquivo → 400; tipo não aceito → 415.
 */
function conferirArquivo(arquivo) {
  if (!arquivo) throw requisicaoInvalida('arquivo: envie o arquivo no campo "arquivo".');
  const tipo = detectarTipo(arquivo.buffer);
  if (!tipo) {
    throw new AppError(415, 'TIPO_NAO_SUPORTADO', `Tipo de arquivo não aceito. Envie ${DESCRICAO_TIPOS_ACEITOS}.`);
  }
  return { tipo, nomeOriginal: nomeSeguro(arquivo.originalname, tipo.extensao) };
}

/**
 * Apaga os arquivos só depois que a transação confirmar: se ela desfizer, os registros voltam e
 * os arquivos continuam lá.
 */
function removerAoConfirmar(trx, caminhos) {
  if (!caminhos.length) return;
  trx.executionPromise
    .then(() => Promise.all(caminhos.map((caminho) => armazenamento.remover(caminho))))
    .catch(() => {});
}

module.exports = { nomeSeguro, conferirArquivo, removerAoConfirmar };
