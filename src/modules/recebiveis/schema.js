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

const ORIGENS = ['dividendos', 'aluguel', 'rendimentos', 'honorarios', 'outros'];
const RECORRENCIAS = ['nenhuma', 'mensal', 'anual'];
// Derivado dos recebimentos: nada recebido, parte ou tudo (ou encerrado com menos).
const STATUS = ['pendente', 'parcial', 'recebido'];

const corpo = z
  .object({
    descricao: z.string().trim().min(1, 'Informe a descrição.').max(200, 'Descrição longa demais.'),
    origem: z.enum(ORIGENS),
    origemDescricao: textoOpcional(100).describe(
      'Obrigatório quando a origem é "outros" ("Especifique a origem"); nas outras é ignorado',
    ),
    valorPrevistoCentavos: centavos,
    dataPrevista: data,
    recorrencia: z.enum(RECORRENCIAS).default('nenhuma'),
    observacoes: textoOpcional(2000),
  })
  .superRefine((v, ctx) => {
    if (v.origem === 'outros' && !v.origemDescricao) {
      ctx.addIssue({ code: 'custom', path: ['origemDescricao'], message: 'Especifique a origem.' });
    }
  });

const filtros = z
  .object({
    inicio: data.optional().describe('Data prevista a partir de (inclusive)'),
    fim: data.optional().describe('Data prevista até (inclusive)'),
    status: z.enum(STATUS).optional(),
    origem: z.enum(ORIGENS).optional(),
  })
  .refine(periodoValido, MENSAGEM_PERIODO);

const recebimentoCorpo = z.object({
  valorCentavos: centavos,
  data: data.optional().describe('Padrão: hoje'),
  observacoes: textoOpcional(2000),
  encerrar: z
    .boolean()
    .default(false)
    .describe('Dá o recebível por recebido mesmo com menos que o previsto (ex.: dividendo menor)'),
});

const paramsRecebimento = z.object({ id, recebimentoId: id });
const paramsComprovante = z.object({ id, comprovanteId: id });

const recebivel = z.object({
  id: z.uuid(),
  descricao: z.string(),
  origem: z.enum(ORIGENS),
  origemDescricao: z.string().nullable().describe('Só na origem "outros" (null nos cadastros antigos)'),
  valorPrevistoCentavos: z.number().int(),
  dataPrevista: z.iso.date(),
  recebidoCentavos: z.number().int().describe('Soma dos recebimentos'),
  saldoCentavos: z.number().int().describe('Quanto falta receber (0 quando recebido ou encerrado)'),
  status: z.enum(STATUS),
  atrasado: z.boolean().describe('Não recebido (pendente ou parcial) com data prevista antes de hoje'),
  encerrado: z.boolean(),
  ultimoRecebimento: z.iso.date().nullable(),
  recorrencia: z.enum(RECORRENCIAS),
  recorrenciaOrigemId: z.uuid().nullable(),
  observacoes: z.string().nullable(),
  totalComprovantes: z.number().int(),
  criadoEm: instante,
  atualizadoEm: instante,
});

const recebimento = z.object({
  id: z.uuid(),
  valorCentavos: z.number().int(),
  data: z.iso.date(),
  observacoes: z.string().nullable(),
  criadoEm: instante,
});

const comprovante = z.object({
  id: z.uuid(),
  nomeOriginal: z.string(),
  mimeType: z.string(),
  tamanhoBytes: z.number().int(),
  criadoEm: instante,
});

const recebivelDetalhe = recebivel.extend({
  recebimentos: z.array(recebimento).describe('Histórico, do mais antigo para o mais novo'),
  comprovantes: z.array(comprovante),
});

module.exports = {
  ORIGENS,
  RECORRENCIAS,
  STATUS,
  corpo,
  filtros,
  recebimentoCorpo,
  paramsRecebimento,
  paramsComprovante,
  recebivel,
  recebivelDetalhe,
};
