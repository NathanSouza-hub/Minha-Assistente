const { DateTime } = require('luxon');
const { z } = require('../../lib/zod');
const { FUSO } = require('../../lib/tempo');
const { data, textoOpcional, instante, periodoValido, MENSAGEM_PERIODO } = require('../../lib/esquemas');

const TIPOS = [
  'reuniao_pessoal',
  'exame',
  'consulta',
  'video',
  'programa_radio',
  'fisioterapia',
  'atividade_fisica',
  // Migration 28: "video" continua valendo nos antigos, mas o formulário oferece estes.
  'videoconferencia',
  'podcast',
  'gravacao',
  'entrevista',
  'outro',
];
const MODALIDADES = ['presencial', 'telemedicina', 'videoconferencia', 'podcast', 'gravacao'];
const RECORRENCIAS = ['nenhuma', 'diaria', 'semanal', 'mensal', 'anual'];

// Intervalo máximo de uma listagem (limita a expansão de séries).
const MAXIMO_DIAS_LISTAGEM = 366;

const dataHora = z.iso.datetime({
  offset: true,
  message: 'Data e hora inválidas: use ISO 8601 com fuso, ex.: 2026-10-20T10:00:00-03:00.',
});

const corpo = z
  .object({
    titulo: z.string().trim().min(1, 'Informe o título.').max(200, 'Título longo demais.'),
    tipo: z.enum(TIPOS),
    tipoDescricao: textoOpcional(100).describe('Obrigatório quando o tipo é "outro" ("Descreva o compromisso")'),
    modalidade: z.enum(MODALIDADES).nullish().transform((v) => v ?? null),
    inicio: dataHora,
    fim: dataHora.nullish().transform((v) => v ?? null),
    local: textoOpcional(300),
    // Campo em branco no formulário ("") vira null.
    link: z
      .url({ protocol: /^https?$/, message: 'Link inválido: use um endereço http(s).' })
      .max(2000)
      .or(z.literal(''))
      .nullish()
      .transform((v) => v || null),
    observacoes: textoOpcional(2000),
    recorrencia: z.enum(RECORRENCIAS).default('nenhuma'),
    recorrenciaFim: data.nullish().transform((v) => v ?? null),
    lembretesMinutosAntes: z
      .array(
        z
          .number()
          .int('Use minutos inteiros.')
          .positive('O lembrete precisa ser antes do evento.')
          .max(43_200, 'No máximo 30 dias antes.'),
      )
      .max(5, 'No máximo 5 lembretes.')
      .refine((lista) => new Set(lista).size === lista.length, 'Há lembretes repetidos.')
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'outro' && !v.tipoDescricao) {
      ctx.addIssue({ code: 'custom', path: ['tipoDescricao'], message: 'Descreva o compromisso.' });
    }
    const inicio = DateTime.fromISO(v.inicio);
    if (v.fim && DateTime.fromISO(v.fim) <= inicio) {
      ctx.addIssue({ code: 'custom', path: ['fim'], message: 'O fim precisa ser depois do início.' });
    }
    if (v.recorrenciaFim) {
      if (v.recorrencia === 'nenhuma') {
        ctx.addIssue({
          code: 'custom',
          path: ['recorrenciaFim'],
          message: 'Só eventos recorrentes têm data final de repetição.',
        });
      } else if (v.recorrenciaFim < inicio.setZone(FUSO).toISODate()) {
        ctx.addIssue({
          code: 'custom',
          path: ['recorrenciaFim'],
          message: 'A repetição precisa terminar depois do início.',
        });
      }
    }
  })
  .meta({
    example: {
      titulo: 'Consulta com cardiologista',
      tipo: 'consulta',
      modalidade: 'telemedicina',
      inicio: '2026-10-20T10:00:00-03:00',
      fim: '2026-10-20T10:30:00-03:00',
      link: 'https://meet.google.com/abc-defg-hij',
      lembretesMinutosAntes: [1080, 120],
    },
  });

const filtros = z
  .object({
    inicio: data.optional().describe('Primeiro dia (padrão: hoje)'),
    fim: data.optional().describe('Último dia, inclusive (padrão: início + 30 dias)'),
    tipo: z.enum(TIPOS).optional(),
  })
  .refine(periodoValido, MENSAGEM_PERIODO)
  .refine(
    (v) =>
      !v.inicio ||
      !v.fim ||
      DateTime.fromISO(v.fim).diff(DateTime.fromISO(v.inicio), 'days').days < MAXIMO_DIAS_LISTAGEM,
    { message: `O período pode ter no máximo ${MAXIMO_DIAS_LISTAGEM} dias.`, path: ['fim'] },
  );

const evento = z.object({
  id: z.uuid().describe('Id da série (o mesmo em todas as ocorrências)'),
  titulo: z.string(),
  tipo: z.enum(TIPOS),
  tipoDescricao: z.string().nullable().describe('Descrição do tipo "outro"; nulo nos demais'),
  modalidade: z.enum(MODALIDADES).nullable(),
  inicio: instante.describe('Início desta ocorrência'),
  fim: instante.nullable().describe('Fim desta ocorrência'),
  local: z.string().nullable(),
  link: z.string().nullable(),
  observacoes: z.string().nullable(),
  recorrencia: z.enum(RECORRENCIAS),
  recorrenciaFim: z.iso.date().nullable(),
  lembretesMinutosAntes: z.array(z.number().int()),
  recorrente: z.boolean(),
  inicioSerie: instante.describe('Início da primeira ocorrência: use este valor no PUT'),
  criadoEm: instante,
  atualizadoEm: instante,
});

module.exports = { corpo, filtros, evento, TIPOS, MODALIDADES, RECORRENCIAS, MAXIMO_DIAS_LISTAGEM };
