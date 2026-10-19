const { z } = require('../../lib/zod');
const { data } = require('../../lib/esquemas');

// Pagamentos que vencem até N dias depois do dia (resumo da manhã).
const DIAS_A_VENCER = 7;

const CATEGORIAS = ['remedio', 'despesa', 'agenda', 'compromisso', 'radio', 'viagem', 'atividade', 'fisioterapia'];
const STATUS = ['pendente', 'feito', 'nao_feito', 'atrasado'];

const filtro = z.object({ data: data.optional().describe('Dia das tarefas (padrão: hoje)') });

// "<categoria>:<idItem>:<ocorrência>", ex.: "remedio:<uuid>:2026-10-19T08:00" ou "viagem:<uuid>:2026-10-19".
const ID_TAREFA = new RegExp(
  `^(${CATEGORIAS.join('|')}):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:` +
    String.raw`\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d)?$`,
);
const paramsTarefa = z.object({
  id: z
    .string()
    .regex(ID_TAREFA, 'Tarefa inválida.')
    .refine((id) => data.safeParse(id.split(':')[2].slice(0, 10)).success, 'Tarefa inválida.'),
});

const marcacao = z.object({
  status: z.enum(['feito', 'nao_feito', 'pendente']).describe('"pendente" desfaz a marcação'),
});

const tarefa = z.object({
  id: z.string().describe('"<categoria>:<idItem>:<ocorrência>"; use no PATCH /hoje/{id}'),
  categoria: z.enum(CATEGORIAS),
  titulo: z.string(),
  detalhe: z.string().nullable().describe('Ex.: "50 mg" ou "R$ 3.300,00 · Imóvel X"'),
  horario: z.string().nullable().describe('"08:00"; nulo = dia todo'),
  status: z.enum(STATUS).describe('atrasado = pendente com horário (ou vencimento) já passado'),
  link: z.string().describe('Rota do item no app'),
  concluirNoFormulario: z
    .boolean()
    .describe('Conta da equipe com valor a definir: o ✓ é dado no formulário da conta, com o valor'),
});

const tarefasDoDia = z.object({
  data: z.iso.date(),
  resumo: z.object({
    programadas: z.number().int(),
    concluidas: z.number().int(),
    pendentes: z.number().int(),
    atrasadas: z.number().int(),
  }),
  tarefas: z.array(tarefa),
});

module.exports = { filtro, paramsTarefa, marcacao, tarefa, tarefasDoDia, DIAS_A_VENCER };
