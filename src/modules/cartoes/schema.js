const { z } = require('../../lib/zod');
const { id, data, centavos, textoOpcional } = require('../../lib/esquemas');

const CORES = ['azul', 'roxo', 'verde', 'laranja', 'vermelho', 'grafite'];
const SITUACOES = ['aberta', 'fechada', 'paga'];

const dia = (rotulo) =>
  z
    .number(`Informe o dia de ${rotulo}.`)
    .int(`O dia de ${rotulo} deve ser inteiro.`)
    .min(1, `O dia de ${rotulo} vai de 1 a 31.`)
    .max(31, `O dia de ${rotulo} vai de 1 a 31.`);

const corpoCartao = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome do cartão.').max(40, 'Nome longo demais.'),
    final: z
      .string()
      .regex(/^\d{4}$/, 'O final do cartão tem 4 dígitos.')
      .nullish()
      .transform((v) => v ?? null),
    cor: z.enum(CORES).default('azul'),
    diaFechamento: dia('fechamento'),
    diaVencimento: dia('vencimento'),
    limiteCentavos: centavos.nullish().transform((v) => v ?? null),
    ordem: z.number().int().min(0).max(32767).optional(),
  })
  .meta({
    example: { nome: 'Nubank', final: '1234', cor: 'roxo', diaFechamento: 3, diaVencimento: 10, limiteCentavos: 500000 },
  });

const corpoCompra = z
  .object({
    descricao: z.string().trim().min(1, 'Informe a descrição.').max(200, 'Descrição longa demais.'),
    valorTotalCentavos: centavos,
    parcelas: z
      .number()
      .int('O número de parcelas deve ser inteiro.')
      .min(1, 'No mínimo 1 parcela.')
      .max(48, 'No máximo 48 parcelas.')
      .default(1),
    dataCompra: data,
    categoriaId: id.nullish().transform((v) => v ?? null),
    observacoes: textoOpcional(2000),
  })
  .meta({ example: { descricao: 'Geladeira', valorTotalCentavos: 360000, parcelas: 10, dataCompra: '2026-10-15' } });

const paramsCompra = z.object({ id, compraId: id });

// A competência na URL é o mês da fatura: "2026-11".
const paramsFatura = z.object({
  id,
  competencia: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Competência inválida: use AAAA-MM.')
    .transform((v) => `${v}-01`),
});

const resumoFatura = z.object({
  competencia: z.iso.date().describe('Dia 1 do mês do vencimento'),
  totalCentavos: z.number().int(),
  vencimento: z.iso.date(),
  situacao: z.enum(SITUACOES),
});

const cartao = z.object({
  id: z.uuid(),
  nome: z.string(),
  final: z.string().nullable(),
  cor: z.enum(CORES),
  diaFechamento: z.number().int(),
  diaVencimento: z.number().int(),
  limiteCentavos: z.number().int().nullable(),
  ordem: z.number().int(),
  limiteDisponivelCentavos: z
    .number()
    .int()
    .nullable()
    .describe('Limite menos as parcelas em faturas não pagas; nulo sem limite'),
  faturaAtual: resumoFatura.describe('Primeira fatura não paga a partir do mês atual'),
});

const compra = z.object({
  id: z.uuid(),
  cartaoId: z.uuid(),
  descricao: z.string(),
  categoriaId: z.uuid().nullable(),
  valorTotalCentavos: z.number().int(),
  parcelas: z.number().int(),
  dataCompra: z.iso.date(),
  observacoes: z.string().nullable(),
  competencias: z.array(z.iso.date()).describe('Faturas em que caem as parcelas, em ordem'),
});

const fatura = z.object({
  competencia: z.iso.date(),
  fechamento: z.iso.date(),
  vencimento: z.iso.date(),
  situacao: z.enum(SITUACOES),
  totalCentavos: z.number().int(),
  pagamentoId: z.uuid().nullable().describe('Conta da fatura em /pagamentos (nula sem compras)'),
  parcelas: z.array(
    z.object({
      compraId: z.uuid(),
      descricao: z.string(),
      categoriaId: z.uuid().nullable(),
      categoriaNome: z.string().nullable(),
      dataCompra: z.iso.date(),
      parcela: z.number().int(),
      totalParcelas: z.number().int(),
      valorCentavos: z.number().int(),
    }),
  ),
});

module.exports = { CORES, corpoCartao, corpoCompra, paramsCompra, paramsFatura, cartao, compra, fatura };
