const db = require('../../config/db');
const env = require('../../config/env');
const app = require('../../lembretes/canais/app');
const whatsapp = require('../../lembretes/canais/whatsapp');
const { AppError } = require('../../lib/erros');
const { CATEGORIAS, origensDa } = require('../../lembretes/categorias');

function exigirConfiguracao() {
  if (!app.ativo()) {
    throw new AppError(503, 'NOTIFICACOES_DESLIGADAS', 'As notificações não estão configuradas neste servidor.');
  }
}

function chavePublica() {
  exigirConfiguracao();
  return { chavePublica: env.VAPID_PUBLIC_KEY };
}

// O endpoint é único por navegador: se outra pessoa entrar no mesmo aparelho, a inscrição passa a ela.
async function inscrever(usuarioId, { endpoint, keys }, userAgent) {
  const [salva] = await db('pushInscricao')
    .insert({ usuarioId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 500) ?? null })
    .onConflict('endpoint')
    .merge(['usuarioId', 'p256dh', 'auth', 'userAgent'])
    .returning(['id', 'endpoint']);
  return salva;
}

// Idempotente: cancelar o que já não existe (ou é de outro usuário) não é erro.
async function cancelar(usuarioId, { endpoint }) {
  await db('pushInscricao').where({ usuarioId, endpoint }).del();
}

async function lerResumo(usuarioId) {
  const { resumoAtivo, resumoHora } = await db('usuario').where({ id: usuarioId }).first('resumoAtivo', 'resumoHora');
  return { ativo: resumoAtivo, hora: resumoHora };
}

// Os resumos já gerados no horário antigo são cancelados; o agendador gera os do horário novo.
async function salvarResumo(usuarioId, { ativo, hora }) {
  await db.transaction(async (trx) => {
    await trx('usuario').where({ id: usuarioId }).update({ resumoAtivo: ativo, resumoHora: hora });
    await trx('lembreteEnvio')
      .where({ usuarioId, origemTipo: 'resumo', status: 'pendente' })
      .update({ status: 'cancelado', erro: 'Resumo mudou de horário ou foi desligado.' });
  });
  return { ativo, hora };
}

async function testar(usuarioId) {
  exigirConfiguracao();
  const resultado = await app.enviar(db, usuarioId, {
    titulo: 'Notificações ligadas',
    corpo: 'É assim que os lembretes vão aparecer neste aparelho.',
    url: '/',
    tag: 'teste',
  });
  if (!resultado.entregue) throw new AppError(409, 'SEM_INSCRICAO', resultado.motivo);
}

async function lerAvisos(usuarioId, conexao = db) {
  const { avisosDesligados } = await conexao('usuario').where({ id: usuarioId }).first('avisosDesligados');
  return Object.fromEntries(CATEGORIAS.map((c) => [c, !avisosDesligados.includes(c)]));
}

// Desligar uma categoria cancela os lembretes pendentes dela; religar volta a gerar no próximo ciclo.
async function salvarAvisos(usuarioId, mudancas) {
  return db.transaction(async (trx) => {
    const atuais = await lerAvisos(usuarioId, trx);
    const novos = { ...atuais, ...mudancas };
    const desligados = CATEGORIAS.filter((c) => !novos[c]);
    await trx('usuario').where({ id: usuarioId }).update({ avisosDesligados: desligados });
    const origens = desligados.filter((c) => atuais[c]).flatMap(origensDa);
    if (origens.length) {
      await trx('lembreteEnvio')
        .where({ usuarioId, status: 'pendente' })
        .whereIn('origemTipo', origens)
        .update({ status: 'cancelado', erro: 'Aviso desta categoria desligado.' });
    }
    return novos;
  });
}

// ——— WhatsApp (decisão 38) ———

async function lerWhatsapp(usuarioId) {
  const { whatsapp: numero } = await db('usuario').where({ id: usuarioId }).first('whatsapp');
  return { disponivel: whatsapp.ativo(), numero };
}

// Trocar o número não mexe nos pendentes (o canal lê o número na hora de enviar); tirar cancela.
async function salvarWhatsapp(usuarioId, { numero }) {
  await db.transaction(async (trx) => {
    await trx('usuario').where({ id: usuarioId }).update({ whatsapp: numero });
    if (!numero) {
      await trx('lembreteEnvio')
        .where({ usuarioId, canal: 'whatsapp', status: 'pendente' })
        .update({ status: 'cancelado', erro: 'Número de WhatsApp removido.' });
    }
  });
  return lerWhatsapp(usuarioId);
}

async function testarWhatsapp(usuarioId) {
  if (!whatsapp.ativo()) {
    throw new AppError(503, 'WHATSAPP_DESLIGADO', 'O WhatsApp não está configurado neste servidor.');
  }
  const { whatsapp: numero } = await db('usuario').where({ id: usuarioId }).first('whatsapp');
  if (!numero) throw new AppError(409, 'SEM_WHATSAPP', 'Cadastre o seu número de WhatsApp primeiro.');
  let resultado;
  try {
    resultado = await whatsapp.enviarParaNumero(numero, {
      titulo: 'Avisos ligados',
      corpo: 'É assim que os lembretes da Minha Assistente vão chegar aqui.',
    });
  } catch (erro) {
    throw new AppError(502, 'WHATSAPP_FALHOU', `O WhatsApp não aceitou a mensagem agora. ${erro.message}`);
  }
  if (!resultado.entregue) throw new AppError(409, 'WHATSAPP_RECUSOU', resultado.motivo);
}

module.exports = {
  chavePublica,
  inscrever,
  cancelar,
  testar,
  lerResumo,
  salvarResumo,
  lerAvisos,
  salvarAvisos,
  lerWhatsapp,
  salvarWhatsapp,
  testarWhatsapp,
};
