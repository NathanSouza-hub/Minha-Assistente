const { z } = require('../../lib/zod');

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

const inscricao = z
  .object({ endpoint, keys: z.object({ p256dh: chave(65), auth: chave(16) }) })
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

module.exports = { inscricao, cancelamento, chavePublica, inscricaoSalva };
