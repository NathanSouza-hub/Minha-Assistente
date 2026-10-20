const { z } = require('../../lib/zod');
const { data, periodoValido, MENSAGEM_PERIODO } = require('../../lib/esquemas');
const { ORIGENS } = require('../recebiveis/schema');

const AGRUPAMENTOS = ['imovel', 'categoria'];

const filtrosGastos = z
  .object({
    inicio: data,
    fim: data,
    agruparPor: z.enum(AGRUPAMENTOS),
  })
  .refine(periodoValido, MENSAGEM_PERIODO);

const relatorioGastos = z.object({
  inicio: z.iso.date(),
  fim: z.iso.date(),
  agruparPor: z.enum(AGRUPAMENTOS),
  totalPagoCentavos: z.number().int(),
  totalPrevistoCentavos: z.number().int(),
  itens: z.array(
    z.object({
      id: z.uuid().nullable().describe('null = pagamentos sem imóvel, ou equipe e faturas de cartão (por categoria)'),
      nome: z.string(),
      pagoCentavos: z.number().int(),
      previstoCentavos: z.number().int(),
    }),
  ),
});

const filtrosFinanceiro = z
  .object({
    inicio: data,
    fim: data,
  })
  .refine(periodoValido, MENSAGEM_PERIODO);

const centavos = z.number().int();

// Contas com vencimento no período, separadas pela situação.
const valoresContas = {
  totalCentavos: centavos.describe('Todas as contas com vencimento no período (pagas ou não)'),
  pagoCentavos: centavos.describe('Das contas do período, as já pagas'),
  pendenteCentavos: centavos.describe('Das contas do período, as ainda pendentes'),
  vencidoCentavos: centavos.describe('Pendentes do período com vencimento antes de hoje'),
};

const relatorioFinanceiro = z.object({
  inicio: z.iso.date(),
  fim: z.iso.date(),
  saidas: z.object({
    ...valoresContas,
    pagoNoPeriodoCentavos: centavos.describe(
      'Realizado: contas pagas com dataPagamento no período, de qualquer vencimento',
    ),
    contasADefinir: z.number().int().describe('Contas da equipe do período com valor a definir (somam 0)'),
  }),
  entradas: z
    .object({
      totalCentavos: centavos.describe('Recebíveis com data prevista no período (valor previsto)'),
      recebidoCentavos: centavos.describe('Já recebido desses recebíveis (soma dos recebimentos, de qualquer data)'),
      pendenteCentavos: centavos.describe('Saldo ainda a receber desses recebíveis'),
      vencidoCentavos: centavos.describe('Saldo a receber dos que tinham data prevista antes de hoje'),
      recebidoNoPeriodoCentavos: centavos.describe('Realizado: recebimentos com data no período, de qualquer recebível'),
      porOrigem: z.array(
        z.object({
          origem: z.enum(ORIGENS),
          totalCentavos: centavos,
          recebidoCentavos: centavos,
          pendenteCentavos: centavos,
        }),
      ),
    })
    .describe('Recebíveis (valores a receber)'),
  saldo: z.object({
    realizadoCentavos: centavos.describe('entradas.recebidoNoPeriodo − saidas.pagoNoPeriodo'),
    projetadoCentavos: centavos.describe('entradas.total − saidas.total (o previsto do período, pelas datas)'),
  }),
  imoveis: z
    .array(z.object({ id: z.uuid(), nome: z.string(), ...valoresContas }))
    .describe('Todos os imóveis do usuário, na ordem dele, mesmo sem contas no período'),
  pessoal: z
    .object({
      ...valoresContas,
      categorias: z.array(
        z.object({
          id: z.uuid().nullable().describe('null = faturas de cartão ou equipe'),
          nome: z.string(),
          totalCentavos: centavos,
        }),
      ),
    })
    .describe('Contas sem imóvel (despesas pessoais, inclusive faturas de cartão e equipe)'),
});

module.exports = { filtrosGastos, relatorioGastos, filtrosFinanceiro, relatorioFinanceiro };
