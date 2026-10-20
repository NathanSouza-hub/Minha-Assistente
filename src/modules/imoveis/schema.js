const { z } = require('../../lib/zod');

// Ausente = não mexe (o PUT de quem só renomeia não apaga o endereço); vazio = apaga.
const textoOpcionalParcial = (max) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null));

const corpo = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome do imóvel.').max(100, 'Nome longo demais.'),
    ordem: z.number().int().min(0).max(32767).optional(),
    endereco: textoOpcionalParcial(300).describe('Opcional. Ausente no PUT mantém o atual; vazio apaga.'),
    complemento: textoOpcionalParcial(100).describe('Identificação complementar, ex.: "Apto 302". Opcional.'),
  })
  .meta({ example: { nome: 'Casa da Serra', ordem: 3, endereco: 'Estrada das Hortênsias, 120' } });

const imovel = z.object({
  id: z.uuid(),
  nome: z.string(),
  ordem: z.number().int(),
  endereco: z.string().nullable(),
  complemento: z.string().nullable(),
});

module.exports = { corpo, imovel };
