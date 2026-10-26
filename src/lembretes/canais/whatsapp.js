// Canal "whatsapp": mensagem pela API oficial da Meta (WhatsApp Cloud API) para o número que cada
// pessoa cadastrou (usuario.whatsapp). Mensagem que a empresa começa precisa de um modelo (template)
// aprovado na Meta: o do app tem duas variáveis no corpo, {{1}} = título e {{2}} = detalhe
// (passo a passo em docs/deploy.md, "WhatsApp").
const env = require('../../config/env');

const nome = 'whatsapp';

const ativo = () => Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_NUMERO_ID);

/** Quem pode receber por este canal: subconsulta usada pelos geradores. */
const usuarios = (conexao) => conexao('usuario').whereNotNull('whatsapp').select('id');

// Variável de modelo não aceita quebra de linha, tabulação nem mais de 4 espaços seguidos (a Meta
// recusa a mensagem inteira), nem texto vazio.
const variavel = (texto, maximo) => (texto ?? '').replace(/\s+/g, ' ').trim().slice(0, maximo) || '—';

// Erros do destinatário: tentar de novo não adianta (o número não tem WhatsApp, não está liberado
// na conta de teste da Meta ou é o próprio remetente).
const ERROS_DO_NUMERO = new Map([
  [131026, 'Este número não recebe mensagens do WhatsApp.'],
  [131030, 'Número não liberado na conta de teste da Meta.'],
  [131021, 'O número é o mesmo que envia as mensagens.'],
]);

/**
 * Envia o modelo para um número (só dígitos, com o código do país).
 * @returns {{ entregue: boolean, motivo?: string }} entregue = a Meta aceitou (a entrega no aparelho
 *   é confirmada depois, por webhook, que o app não usa); lança erro para o agendador tentar de novo.
 */
async function enviarParaNumero(numero, { titulo, corpo }) {
  const resposta = await fetch(`https://graph.facebook.com/${env.WHATSAPP_API_VERSAO}/${env.WHATSAPP_NUMERO_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numero,
      type: 'template',
      template: {
        name: env.WHATSAPP_MODELO,
        language: { code: env.WHATSAPP_MODELO_IDIOMA },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: variavel(titulo, 200) },
              { type: 'text', text: variavel(corpo, 600) },
            ],
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (resposta.ok) return { entregue: true };

  const erro = (await resposta.json().catch(() => null))?.error;
  const motivo = ERROS_DO_NUMERO.get(erro?.code);
  if (motivo) return { entregue: false, motivo };
  throw new Error(`WhatsApp respondeu ${resposta.status}: ${erro?.message ?? 'erro desconhecido'}`);
}

async function enviar(conexao, usuarioId, mensagem) {
  const { whatsapp } = await conexao('usuario').where({ id: usuarioId }).first('whatsapp');
  if (!whatsapp) return { entregue: false, motivo: 'Sem número de WhatsApp cadastrado.' };
  return enviarParaNumero(whatsapp, mensagem);
}

module.exports = { nome, ativo, usuarios, enviar, enviarParaNumero };
