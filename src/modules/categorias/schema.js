const { z } = require('../../lib/zod');

const categoria = z.object({ id: z.uuid(), nome: z.string(), ordem: z.number().int() });

module.exports = { categoria };
