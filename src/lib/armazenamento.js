// Armazenamento de arquivos em disco local (UPLOADS_DIR). Para trocar por S3, basta manter
// a mesma interface: salvar, caminhoAbsoluto, remover.
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const env = require('../config/env');

const RAIZ = path.resolve(env.UPLOADS_DIR);

/** Grava o conteúdo com nome aleatório e devolve esse nome (o "caminho" guardado no banco). */
async function salvar(conteudo, extensao) {
  await fs.mkdir(RAIZ, { recursive: true });
  const nome = `${randomUUID()}${extensao}`;
  await fs.writeFile(path.join(RAIZ, nome), conteudo, { flag: 'wx' });
  return nome;
}

// Garante que o arquivo está direto dentro da raiz (nada de "../").
function caminhoAbsoluto(nome) {
  const absoluto = path.resolve(RAIZ, nome);
  if (path.dirname(absoluto) !== RAIZ) throw new Error(`Caminho de arquivo inválido: ${nome}`);
  return absoluto;
}

async function remover(nome) {
  await fs.rm(caminhoAbsoluto(nome), { force: true });
}

module.exports = { salvar, caminhoAbsoluto, remover, RAIZ };
