// Só respostas (as rotas do WhatsApp não recebem corpo); usadas no OpenAPI.
const { z } = require('../../lib/zod');
const esquemas = require('../../lib/esquemas');

const situacao = z
  .object({
    disponivel: z.boolean().describe('false: o servidor está sem as chaves do WhatsApp'),
    numero: z.string().nullable().describe('Número do app, só dígitos com o país'),
    vinculado: z.boolean(),
    telefone: z.string().nullable().describe('Número ligado, mascarado ("•••• 4321")'),
    vinculadoEm: esquemas.instante.nullable(),
  })
  .meta({
    example: { disponivel: true, numero: '5511999990000', vinculado: true, telefone: '•••• 4321', vinculadoEm: '2026-10-26T10:00:00-03:00' },
  });

const codigo = z
  .object({
    codigo: z.string().regex(/^\d{6}$/),
    expiraEm: esquemas.instante,
    numero: z.string(),
    link: z.string().describe('wa.me com o código já escrito'),
  })
  .meta({
    example: {
      codigo: '482913',
      expiraEm: '2026-10-26T10:10:00-03:00',
      numero: '5511999990000',
      link: 'https://wa.me/5511999990000?text=482913',
    },
  });

module.exports = { situacao, codigo };
