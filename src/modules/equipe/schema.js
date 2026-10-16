const { z } = require('../../lib/zod');
const { centavos, textoOpcional } = require('../../lib/esquemas');

const FORMAS = ['mensal', 'plantao', 'honorario'];

const diaPagamento = z.object({
  dia: z
    .number('Informe o dia do pagamento.')
    .int('O dia do pagamento deve ser inteiro.')
    .min(1, 'O dia do pagamento vai de 1 a 31.')
    .max(31, 'O dia do pagamento vai de 1 a 31.'),
  valorPrevistoCentavos: centavos.nullish().transform((v) => v ?? null),
});

const corpo = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome.').max(80, 'Nome longo demais.'),
    funcao: textoOpcional(60),
    formaPagamento: z.enum(FORMAS),
    chavePix: textoOpcional(140),
    ativo: z.boolean().default(true),
    dias: z
      .array(diaPagamento)
      .min(1, 'Informe pelo menos um dia de pagamento.')
      .max(10, 'No máximo 10 dias de pagamento.')
      .refine((dias) => new Set(dias.map((d) => d.dia)).size === dias.length, 'Há dias de pagamento repetidos.')
      .transform((dias) => [...dias].sort((a, b) => a.dia - b.dia)),
  })
  .meta({
    example: {
      nome: 'Joana',
      funcao: 'Cuidadora',
      formaPagamento: 'mensal',
      chavePix: 'joana@exemplo.com',
      dias: [{ dia: 5, valorPrevistoCentavos: 150000 }, { dia: 20 }],
    },
  });

const membro = z.object({
  id: z.uuid(),
  nome: z.string(),
  funcao: z.string().nullable(),
  formaPagamento: z.enum(FORMAS),
  chavePix: z.string().nullable(),
  ativo: z.boolean(),
  dias: z.array(
    z.object({
      dia: z.number().int(),
      valorPrevistoCentavos: z.number().int().nullable().describe('Nulo = a conta nasce com valor a definir'),
    }),
  ),
});

module.exports = { FORMAS, corpo, membro };
