const { z } = require('../../lib/zod');
const { id, data, textoOpcional, instante } = require('../../lib/esquemas');

const corpo = z
  .object({
    destino: z.string().trim().min(1, 'Informe o destino.').max(200, 'Destino longo demais.'),
    ida: data,
    volta: data.nullish().transform((v) => v ?? null),
    hospedagem: textoOpcional(500),
    transporte: textoOpcional(500),
    observacoes: textoOpcional(2000),
  })
  .refine((v) => !v.volta || v.volta >= v.ida, {
    message: 'A volta precisa ser no mesmo dia ou depois da ida.',
    path: ['volta'],
  })
  .meta({
    example: {
      destino: 'Lisboa',
      ida: '2026-12-20',
      volta: '2027-01-05',
      hospedagem: 'Hotel Avenida, reserva 12345',
      transporte: 'Voo TP 088',
    },
  });

const paramsAnexo = z.object({ id, anexoId: id });

const anexo = z.object({
  id: z.uuid(),
  nomeOriginal: z.string(),
  mimeType: z.string(),
  tamanhoBytes: z.number().int(),
  criadoEm: instante,
});

const viagem = z.object({
  id: z.uuid(),
  destino: z.string(),
  ida: z.iso.date(),
  volta: z.iso.date().nullable(),
  hospedagem: z.string().nullable(),
  transporte: z.string().nullable(),
  observacoes: z.string().nullable(),
  anexos: z.array(anexo),
  criadoEm: instante,
  atualizadoEm: instante,
});

module.exports = { corpo, paramsAnexo, anexo, viagem };
