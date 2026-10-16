const db = require('../../config/db');
const env = require('../../config/env');
const app = require('../../lembretes/canais/app');
const { AppError } = require('../../lib/erros');

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

module.exports = { chavePublica, inscrever, cancelar, testar, lerResumo, salvarResumo };
