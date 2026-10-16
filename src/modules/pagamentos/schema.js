const { z } = require('../../lib/zod');
const {
  id,
  data,
  centavos,
  textoOpcional,
  instante,
  periodoValido,
  MENSAGEM_PERIODO,
} = require('../../lib/esquemas');

const STATUS = ['pendente', 'pago'];
const RECORRENCIAS = ['nenhuma', 'mensal', 'anual'];

const campos = {
  descricao: z.string().trim().min(1, 'Informe a descrição.').max(200, 'Descrição longa demais.'),
  categoriaId: id,
  imovelId: id.nullish().transform((v) => v ?? null),
  valorCentavos: centavos,
  vencimento: data,
  status: z.enum(STATUS).default('pendente'),
  dataPagamento: data.nullish().transform((v) => v ?? null),
  recorrencia: z.enum(RECORRENCIAS).default('nenhuma'),
  observacoes: textoOpcional(2000),
};

function regraDataPagamento(v, ctx) {
  if (v.status === 'pago' && !v.dataPagamento) {
    ctx.addIssue({ code: 'custom', path: ['dataPagamento'], message: 'Informe a data do pagamento.' });
  }
  if (v.status === 'pendente' && v.dataPagamento) {
    ctx.addIssue({
      code: 'custom',
      path: ['dataPagamento'],
      message: 'Pagamento pendente não tem data de pagamento.',
    });
  }
}

const criacao = z
  .object({
    ...campos,
    // valorCentavos é o valor de CADA parcela.
    parcelamento: z
      .object({
        totalParcelas: z
          .number()
          .int()
          .min(2, 'O parcelamento precisa de pelo menos 2 parcelas.')
          .max(120, 'No máximo 120 parcelas.'),
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    regraDataPagamento(v, ctx);
    if (!v.parcelamento) return;
    if (v.recorrencia !== 'nenhuma') {
      ctx.addIssue({ code: 'custom', path: ['recorrencia'], message: 'Pagamento parcelado não pode ser recorrente.' });
    }
    if (v.status !== 'pendente') {
      ctx.addIssue({ code: 'custom', path: ['status'], message: 'As parcelas são criadas como pendentes.' });
    }
  })
  .meta({
    example: {
      descricao: 'Condomínio',
      categoriaId: '00000000-0000-4000-8000-000000000000',
      imovelId: null,
      valorCentavos: 125000,
      vencimento: '2026-11-10',
      recorrencia: 'mensal',
    },
  });

const edicao = z.object(campos).superRefine(regraDataPagamento);

const pagar = z.object({ dataPagamento: data.optional() });

const filtros = z
  .object({
    inicio: data.optional().describe('Vencimento a partir de (inclusive)'),
    fim: data.optional().describe('Vencimento até (inclusive)'),
    status: z.enum(STATUS).optional(),
    categoriaId: id.optional(),
    imovelId: id.optional(),
  })
  .refine(periodoValido, MENSAGEM_PERIODO);

const pagamento = z.object({
  id: z.uuid(),
  descricao: z.string(),
  categoriaId: z.uuid().nullable().describe('Nulo só na fatura de cartão'),
  categoriaNome: z.string().nullable(),
  imovelId: z.uuid().nullable(),
  imovelNome: z.string().nullable(),
  valorCentavos: z.number().int(),
  vencimento: z.iso.date(),
  status: z.enum(STATUS),
  dataPagamento: z.iso.date().nullable(),
  vencido: z.boolean().describe('Pendente com vencimento antes de hoje'),
  recorrencia: z.enum(RECORRENCIAS),
  recorrenciaOrigemId: z.uuid().nullable(),
  parcelamentoGrupoId: z.uuid().nullable(),
  parcelaAtual: z.number().int().nullable(),
  parcelaTotal: z.number().int().nullable(),
  observacoes: z.string().nullable(),
  cartaoId: z.uuid().nullable().describe('Preenchido na fatura de cartão (não editável aqui, só paga)'),
  cartaoNome: z.string().nullable(),
  competencia: z.iso.date().nullable().describe('Mês da fatura (dia 1)'),
  totalComprovantes: z.number().int().describe('Quantos comprovantes a conta tem (a lista vem em GET /:id)'),
  criadoEm: instante,
  atualizadoEm: instante,
});

const paramsComprovante = z.object({ id, comprovanteId: id });

const comprovante = z.object({
  id: z.uuid(),
  nomeOriginal: z.string(),
  mimeType: z.string(),
  tamanhoBytes: z.number().int(),
  criadoEm: instante,
});

const pagamentoDetalhe = pagamento.extend({ comprovantes: z.array(comprovante) });

module.exports = {
  criacao,
  edicao,
  pagar,
  filtros,
  pagamento,
  pagamentoDetalhe,
  paramsComprovante,
  comprovante,
  STATUS,
  RECORRENCIAS,
};
