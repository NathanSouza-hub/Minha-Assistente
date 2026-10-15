const { z } = require('../../lib/zod');

const nome = z.string().trim().min(1, 'Informe o nome da categoria.').max(40, 'Nome longo demais.');
const ordem = z.number().int().min(0).max(32767);

const corpoCriar = z
  .object({ nome, ordem: ordem.optional() })
  .meta({ example: { nome: 'Plano de saúde' } });

// Renomear, reordenar ou os dois.
const corpoAtualizar = z
  .object({ nome: nome.optional(), ordem: ordem.optional() })
  .refine((c) => c.nome !== undefined || c.ordem !== undefined, 'Informe o nome ou a ordem.')
  .meta({ example: { nome: 'Plano de saúde', ordem: 2 } });

const categoria = z.object({ id: z.uuid(), nome: z.string(), ordem: z.number().int() });

module.exports = { corpoCriar, corpoAtualizar, categoria };
