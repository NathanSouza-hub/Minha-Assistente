// Vínculo do WhatsApp (decisão 38): o app gera um código de 6 dígitos, a pessoa manda o código
// para o número do app e o webhook liga o número dela à conta.
const crypto = require('node:crypto');
const db = require('../../config/db');
const env = require('../../config/env');
const claude = require('../../lib/claude');
const whatsapp = require('../../lib/whatsapp');
const { AppError } = require('../../lib/erros');

const VALIDADE_MS = 10 * 60_000;

const hashDoCodigo = (codigo) => crypto.createHash('sha256').update(codigo).digest('hex');

function exigirConfiguracao() {
  if (!whatsapp.ativo()) {
    throw new AppError(503, 'WHATSAPP_DESLIGADO', 'O WhatsApp não está configurado neste servidor.');
  }
}

const linkDoCodigo = (codigo) => `https://wa.me/${env.WHATSAPP_NUMERO}?text=${codigo}`;

// "5511987654321" → "•••• 4321": a tela só precisa reconhecer o número.
const mascarar = (telefone) => (telefone ? `•••• ${telefone.slice(-4)}` : null);

async function situacao(usuarioId) {
  const vinculo = await db('whatsappVinculo').where({ usuarioId }).first('telefone', 'vinculadoEm');
  return {
    disponivel: whatsapp.ativo(),
    assistente: whatsapp.ativo() && claude.ativo(),
    numero: whatsapp.ativo() ? env.WHATSAPP_NUMERO : null,
    vinculado: Boolean(vinculo?.telefone),
    telefone: mascarar(vinculo?.telefone),
    vinculadoEm: vinculo?.telefone ? vinculo.vinculadoEm : null,
  };
}

/** Código novo (o anterior deixa de valer). Não mexe no número já ligado: mandar o código troca. */
async function gerarCodigo(usuarioId) {
  exigirConfiguracao();
  // O código é único entre os pendentes; numa colisão (rara), sorteia de novo.
  for (let tentativa = 0; ; tentativa += 1) {
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    try {
      const [salvo] = await db('whatsappVinculo')
        .insert({ usuarioId, codigoHash: hashDoCodigo(codigo), codigoExpiraEm: new Date(Date.now() + VALIDADE_MS) })
        .onConflict('usuarioId')
        .merge(['codigoHash', 'codigoExpiraEm'])
        .returning(['codigoExpiraEm']);
      return { codigo, expiraEm: salvo.codigoExpiraEm, numero: env.WHATSAPP_NUMERO, link: linkDoCodigo(codigo) };
    } catch (erro) {
      if (erro.code !== '23505' || tentativa >= 4) throw erro;
    }
  }
}

// Os lembretes pendentes pelo WhatsApp de quem fica sem número não têm para onde ir. Trocar de número
// não mexe neles: o canal lê o número na hora de enviar.
const cancelarLembretes = (conexao, usuarioIds) =>
  conexao('lembreteEnvio')
    .whereIn('usuarioId', usuarioIds)
    .where({ canal: 'whatsapp', status: 'pendente' })
    .update({ status: 'cancelado', erro: 'WhatsApp desligado da conta.' });

async function desvincular(usuarioId) {
  await db.transaction(async (trx) => {
    await trx('whatsappVinculo')
      .where({ usuarioId })
      .update({ telefone: null, vinculadoEm: null, codigoHash: null, codigoExpiraEm: null });
    await cancelarLembretes(trx, [usuarioId]);
  });
}

/**
 * Liga `telefone` à conta dona do código, se ele existir e não tiver vencido. Se o número estava
 * em outra conta, sai de lá. Devolve o usuário ({ id, nome }) ou null.
 */
async function vincularPorCodigo(telefone, codigo, agora = new Date()) {
  return db.transaction(async (trx) => {
    const vinculo = await trx('whatsappVinculo')
      .where({ codigoHash: hashDoCodigo(codigo) })
      .where('codigoExpiraEm', '>', agora)
      .forUpdate()
      .first('id', 'usuarioId');
    if (!vinculo) return null;
    const anteriores = await trx('whatsappVinculo')
      .where({ telefone })
      .whereNot({ id: vinculo.id })
      .update({ telefone: null, vinculadoEm: null })
      .returning('usuarioId');
    if (anteriores.length) await cancelarLembretes(trx, anteriores.map((a) => a.usuarioId));
    await trx('whatsappVinculo')
      .where({ id: vinculo.id })
      .update({ telefone, vinculadoEm: agora, codigoHash: null, codigoExpiraEm: null });
    return trx('usuario').where({ id: vinculo.usuarioId }).first('id', 'nome');
  });
}

/** Dono do número, ou undefined. */
const usuarioDoTelefone = (telefone) =>
  db('whatsappVinculo')
    .join('usuario', 'usuario.id', 'whatsappVinculo.usuarioId')
    .where('whatsappVinculo.telefone', telefone)
    .first('usuario.id', 'usuario.nome');

module.exports = { situacao, gerarCodigo, desvincular, vincularPorCodigo, usuarioDoTelefone, hashDoCodigo };
