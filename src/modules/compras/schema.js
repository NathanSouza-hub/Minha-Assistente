const { z } = require('../../lib/zod');
const { textoOpcional, instante } = require('../../lib/esquemas');

const corpo = z
  .object({
    nome: z.string().trim().min(1, 'Informe o item.').max(120, 'Nome longo demais.'),
    categoria: textoOpcional(60).describe('Ex.: Mercado, Farmácia'),
    quantidade: textoOpcional(60).describe('Texto livre, ex.: "2 kg", "3 un"'),
  })
  .meta({ example: { nome: 'Leite integral', categoria: 'Mercado', quantidade: '6 caixas' } });

const filtros = z.object({
  comprado: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
    .describe('true = só comprados; false = só pendentes'),
});

const marcar = z.object({ comprado: z.boolean().default(true).describe('false desmarca') });

const item = z.object({
  id: z.uuid(),
  nome: z.string(),
  categoria: z.string().nullable(),
  quantidade: z.string().nullable(),
  comprado: z.boolean(),
  compradoEm: instante.nullable(),
  criadoEm: instante,
  atualizadoEm: instante,
});

module.exports = { corpo, filtros, marcar, item };
