const { z } = require('../../lib/zod');
const { id, data, hora, textoOpcional, instante } = require('../../lib/esquemas');

const PERIODOS = ['manha', 'tarde', 'noite', 'semanal'];
const SITUACOES = ['tomado', 'nao_tomado', 'pendente'];

const horarioEntrada = z
  .object({
    id: id.optional().describe('Envie no PUT para manter um horário existente (e seu histórico)'),
    periodo: z.enum(PERIODOS),
    hora,
    diaSemana: z
      .number()
      .int()
      .min(0, 'Dia da semana de 0 (domingo) a 6 (sábado).')
      .max(6, 'Dia da semana de 0 (domingo) a 6 (sábado).')
      .nullish()
      .transform((v) => v ?? null)
      .describe('0 = domingo ... 6 = sábado. Obrigatório no semanal.'),
  })
  .superRefine((v, ctx) => {
    if (v.periodo === 'semanal' && v.diaSemana === null) {
      ctx.addIssue({ code: 'custom', path: ['diaSemana'], message: 'Informe o dia da semana do remédio semanal.' });
    }
    if (v.periodo !== 'semanal' && v.diaSemana !== null) {
      ctx.addIssue({ code: 'custom', path: ['diaSemana'], message: 'Dia da semana só vale para o período semanal.' });
    }
  });

const corpo = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome do remédio.').max(120, 'Nome longo demais.'),
    dose: textoOpcional(120),
    observacoes: textoOpcional(2000),
    ativo: z.boolean().default(true),
    dataInicio: data.nullish().transform((v) => v ?? null).describe('Primeiro dia de uso (vazio: sem limite)'),
    dataFim: data.nullish().transform((v) => v ?? null).describe('Último dia de uso, inclusive (vazio: uso contínuo)'),
    intervaloHoras: z
      .number()
      .int('Use horas inteiras.')
      .min(1, 'O intervalo vai de 1 a 24 horas.')
      .max(24, 'O intervalo vai de 1 a 24 horas.')
      .nullish()
      .transform((v) => v ?? null)
      .describe('"A cada N horas" usado para montar os horários (só registro; os horários vêm prontos)'),
    horarios: z
      .array(horarioEntrada)
      .min(1, 'Cadastre pelo menos um horário.')
      .max(12, 'No máximo 12 horários.')
      .refine((lista) => {
        const ids = lista.map((h) => h.id).filter(Boolean);
        return new Set(ids).size === ids.length;
      }, 'Há horários repetidos.'),
  })
  .refine((v) => !v.dataInicio || !v.dataFim || v.dataFim >= v.dataInicio, {
    path: ['dataFim'],
    message: 'O fim do uso precisa ser no dia do início ou depois.',
  })
  .meta({
    example: {
      nome: 'Losartana',
      dose: '1 comprimido de 50 mg',
      observacoes: 'Tomar em jejum',
      dataInicio: '2026-10-20',
      dataFim: '2026-10-27',
      horarios: [
        { periodo: 'manha', hora: '08:00' },
        { periodo: 'noite', hora: '20:00' },
        { periodo: 'semanal', hora: '09:00', diaSemana: 1 },
      ],
    },
  });

const filtroDia = z.object({ data: data.optional().describe('Dia (padrão: hoje)') });

const registro = z
  .object({
    horarioId: id,
    data: data.optional().describe('Dia (padrão: hoje)'),
    tomado: z.boolean().default(true).describe('false desmarca'),
    situacao: z
      .enum(SITUACOES)
      .optional()
      .describe('Substitui `tomado`: "nao_tomado" registra que a dose não foi tomada; "pendente" limpa'),
  })
  .meta({ example: { horarioId: '00000000-0000-4000-8000-000000000000' } });

const horario = z.object({
  id: z.uuid(),
  periodo: z.enum(PERIODOS),
  hora: z.string().nullable(),
  diaSemana: z.number().int().nullable(),
});

const medicamento = z.object({
  id: z.uuid(),
  nome: z.string(),
  dose: z.string().nullable(),
  observacoes: z.string().nullable(),
  ativo: z.boolean(),
  dataInicio: z.iso.date().nullable(),
  dataFim: z.iso.date().nullable(),
  intervaloHoras: z.number().int().nullable(),
  horarios: z.array(horario),
  criadoEm: instante,
  atualizadoEm: instante,
});

const itemDoDia = z.object({
  horarioId: z.uuid(),
  medicamentoId: z.uuid(),
  nome: z.string(),
  dose: z.string().nullable(),
  observacoes: z.string().nullable(),
  periodo: z.enum(PERIODOS),
  hora: z.string().nullable(),
  data: z.iso.date(),
  tomado: z.boolean(),
  tomadoEm: instante.nullable(),
  situacao: z.enum(SITUACOES).describe('"nao_tomado" é o ✗ (aqui ou na tela Hoje)'),
});

module.exports = { corpo, filtroDia, registro, medicamento, itemDoDia, PERIODOS, SITUACOES };
