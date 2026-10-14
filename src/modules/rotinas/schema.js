const { z } = require('../../lib/zod');
const { data, hora, instante } = require('../../lib/esquemas');

const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];

const corpo = z
  .object({
    titulo: z.string().trim().min(1, 'Informe o título da tarefa.').max(200, 'Título longo demais.'),
    hora,
    diasSemana: z
      .array(z.number().int().min(0).max(6, 'Dias da semana de 0 (domingo) a 6 (sábado).'))
      .min(1, 'Escolha pelo menos um dia da semana.')
      .refine((dias) => new Set(dias).size === dias.length, 'Há dias repetidos.')
      .transform((dias) => [...dias].sort((a, b) => a - b))
      .default(TODOS_OS_DIAS)
      .describe('0 = domingo ... 6 = sábado. Padrão: todos os dias.'),
    ativo: z.boolean().default(true),
    ordem: z.number().int().min(0).max(32767).default(0),
    lembrete: z.boolean().default(false).describe('Avisar no horário (exige hora)'),
  })
  .refine((v) => !v.lembrete || v.hora, {
    message: 'Para receber lembrete, informe a hora.',
    path: ['hora'],
  })
  .meta({ example: { titulo: 'Ler e-mails', hora: '09:00', diasSemana: [1, 2, 3, 4, 5], lembrete: true } });

const filtroDia = z.object({ data: data.optional().describe('Dia (padrão: hoje)') });

const conclusao = z.object({
  data: data.optional().describe('Dia (padrão: hoje)'),
  concluida: z.boolean().default(true).describe('false desmarca'),
});

const rotina = z.object({
  id: z.uuid(),
  titulo: z.string(),
  hora: z.string().nullable(),
  diasSemana: z.array(z.number().int()),
  ativo: z.boolean(),
  ordem: z.number().int(),
  lembrete: z.boolean(),
  criadoEm: instante,
  atualizadoEm: instante,
});

const itemDoDia = z.object({
  rotinaId: z.uuid(),
  titulo: z.string(),
  hora: z.string().nullable(),
  ordem: z.number().int(),
  data: z.iso.date(),
  concluida: z.boolean(),
  concluidaEm: instante.nullable(),
});

module.exports = { corpo, filtroDia, conclusao, rotina, itemDoDia };
