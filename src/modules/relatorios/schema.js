const { z } = require('../../lib/zod');
const { data, periodoValido, MENSAGEM_PERIODO } = require('../../lib/esquemas');

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
      id: z.uuid().nullable().describe('null = pagamentos sem imóvel'),
      nome: z.string(),
      pagoCentavos: z.number().int(),
      previstoCentavos: z.number().int(),
    }),
  ),
});

module.exports = { filtrosGastos, relatorioGastos };
