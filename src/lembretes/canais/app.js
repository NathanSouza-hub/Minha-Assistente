// Canal "app": notificação Web Push (VAPID) em cada navegador inscrito pelo usuário.
const webpush = require('web-push');
const env = require('../../config/env');
const { endpointPermitido } = require('../../lib/push');

const nome = 'app';

const ativo = () => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

let configurado = false;
function configurar() {
  if (configurado) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configurado = true;
}

/** Quem pode receber por este canal: subconsulta usada pelos geradores. */
const usuarios = (conexao) => conexao('pushInscricao').distinct('usuarioId');

// O serviço de push responde 404/410 quando o navegador cancelou a inscrição (ou ela venceu).
const expirou = (erro) => erro?.statusCode === 404 || erro?.statusCode === 410;

/**
 * Envia para todos os aparelhos do usuário. Inscrições expiradas são apagadas.
 * @returns {{ entregue: boolean, motivo?: string }} entregue se chegou a pelo menos um aparelho;
 *   lança erro (para tentar de novo) se todos falharam por outro motivo.
 */
async function enviar(conexao, usuarioId, mensagem) {
  const todas = await conexao('pushInscricao').select('id', 'endpoint', 'p256dh', 'auth').where({ usuarioId });
  // Defesa extra: inscrição gravada fora da lista de serviços de push nunca recebe POST; é apagada.
  const invalidas = todas.filter((i) => !endpointPermitido(i.endpoint));
  if (invalidas.length) await conexao('pushInscricao').whereIn('id', invalidas.map((i) => i.id)).del();
  const inscricoes = todas.filter((i) => endpointPermitido(i.endpoint));
  if (!inscricoes.length) return { entregue: false, motivo: 'Nenhum aparelho inscrito.' };

  configurar();
  const carga = JSON.stringify(mensagem);
  const resultados = await Promise.allSettled(
    inscricoes.map((i) =>
      webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, carga, {
        // Lembrete velho não serve: se o aparelho ficar 1h sem internet, o serviço descarta.
        TTL: 3600,
        urgency: 'high',
        timeout: 10_000,
      }),
    ),
  );

  const expiradas = inscricoes.filter((_, i) => resultados[i].status === 'rejected' && expirou(resultados[i].reason));
  if (expiradas.length) await conexao('pushInscricao').whereIn('id', expiradas.map((i) => i.id)).del();

  if (resultados.some((r) => r.status === 'fulfilled')) return { entregue: true };
  const falha = resultados.find((r) => r.status === 'rejected' && !expirou(r.reason));
  if (falha) throw falha.reason;
  return { entregue: false, motivo: 'As inscrições dos aparelhos expiraram.' };
}

module.exports = { nome, ativo, usuarios, enviar };
