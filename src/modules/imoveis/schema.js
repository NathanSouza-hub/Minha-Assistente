const { z } = require('../../lib/zod');

const corpo = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome do imóvel.').max(100, 'Nome longo demais.'),
    ordem: z.number().int().min(0).max(32767).optional(),
  })
  .meta({ example: { nome: 'Casa da Serra', ordem: 3 } });

const imovel = z.object({ id: z.uuid(), nome: z.string(), ordem: z.number().int() });

module.exports = { corpo, imovel };
