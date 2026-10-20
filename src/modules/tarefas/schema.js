const { z } = require('../../lib/zod');
const { data, hora, textoOpcional, instante, periodoValido, MENSAGEM_PERIODO } = require('../../lib/esquemas');

const corpo = z
  .object({
    titulo: z.string().trim().min(1, 'Informe a tarefa.').max(200, 'Título longo demais.'),
    detalhes: textoOpcional(2000),
    data,
    hora,
    lembrete: z.boolean().default(false).describe('Aviso no aparelho na hora marcada (exige hora)'),
  })
  .refine((v) => !v.lembrete || v.hora, { message: 'Para receber lembrete, informe a hora.', path: ['hora'] });

const filtros = z
  .object({
    inicio: data.optional().describe('Data a partir de (inclusive)'),
    fim: data.optional().describe('Data até (inclusive)'),
    situacao: z.enum(['pendente', 'concluida']).optional(),
  })
  .refine(periodoValido, MENSAGEM_PERIODO);

const conclusao = z.object({
  concluida: z.boolean().default(true).describe('false reabre a tarefa'),
});

const tarefa = z.object({
  id: z.uuid(),
  titulo: z.string(),
  detalhes: z.string().nullable(),
  data: z.iso.date(),
  hora: z.string().nullable().describe('"08:00"; null = sem hora'),
  lembrete: z.boolean(),
  concluida: z.boolean(),
  concluidaEm: instante.nullable().describe('Quando foi concluída (histórico mínimo)'),
  atrasada: z.boolean().describe('Pendente com data antes de hoje'),
  criadoEm: instante,
  atualizadoEm: instante,
});

module.exports = { corpo, filtros, conclusao, tarefa };
