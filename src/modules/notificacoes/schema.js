const { z } = require('../../lib/zod');
const { endpointPermitido } = require('../../lib/push');
const esquemas = require('../../lib/esquemas');
const { CATEGORIAS } = require('../../lembretes/categorias');

// Chaves da inscrição do navegador (PushSubscription.toJSON().keys), em base64url. O tamanho é
// conferido aqui: com uma chave malformada, todo envio para o usuário falharia depois.
const chave = (bytes) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+={0,2}$/, 'Chave inválida.')
    .refine((v) => Buffer.from(v, 'base64url').length === bytes, `A chave precisa ter ${bytes} bytes.`);

const endpoint = z
  .url({ protocol: /^https$/, error: 'Endereço de inscrição inválido.' })
  .max(1000, 'Endereço de inscrição longo demais.');

// Ao inscrever, só serviços de push conhecidos (src/lib/push.js). Cancelar aceita qualquer URL,
// para que uma inscrição antiga fora da lista ainda possa ser removida.
const endpointInscricao = endpoint.refine(endpointPermitido, 'Serviço de push não reconhecido.');

const inscricao = z
  .object({ endpoint: endpointInscricao, keys: z.object({ p256dh: chave(65), auth: chave(16) }) })
  .meta({
    example: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/c1KrmpTuRm...',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    },
  });

const cancelamento = z.object({ endpoint });

const chavePublica = z.object({ chavePublica: z.string().describe('applicationServerKey do pushManager.subscribe') });

const inscricaoSalva = z.object({ id: z.uuid(), endpoint: z.string() });

// Resumo da manhã (usuario.resumo_ativo / resumo_hora).
const resumo = z
  .object({
    ativo: z.boolean(),
    hora: esquemas.hora.refine((v) => v !== null, 'Informe a hora do resumo.'),
  })
  .meta({ example: { ativo: true, hora: '07:00' } });

// O que avisar, por categoria (usuario.avisos_desligados). No PUT, categoria ausente fica como está.
const avisos = z
  .object(Object.fromEntries(CATEGORIAS.map((c) => [c, z.boolean()])))
  .meta({ example: { agenda: true, remedios: true, contas: true, compromissos: true, tarefas: false } });
const avisosParcial = avisos
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Informe pelo menos uma categoria.');

module.exports = { inscricao, cancelamento, chavePublica, inscricaoSalva, resumo, avisos, avisosParcial };
