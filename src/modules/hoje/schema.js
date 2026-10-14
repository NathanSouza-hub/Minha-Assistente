const { z } = require('../../lib/zod');
const { data } = require('../../lib/esquemas');
const { evento } = require('../eventos/schema');
const { itemDoDia: remedio } = require('../medicamentos/schema');
const { itemDoDia: tarefa } = require('../rotinas/schema');
const { pagamento } = require('../pagamentos/schema');

// Pagamentos que vencem até N dias depois do dia do painel.
const DIAS_A_VENCER = 7;

const filtro = z.object({ data: data.optional().describe('Dia do painel (padrão: hoje)') });

const painel = z.object({
  data: z.iso.date(),
  resumo: z.object({
    eventos: z.number().int(),
    remediosPendentes: z.number().int(),
    tarefasPendentes: z.number().int(),
    pagamentosVencidos: z.number().int(),
    pagamentosAVencer: z.number().int(),
  }),
  eventos: z.array(evento),
  medicamentos: z.array(remedio),
  rotina: z.array(tarefa),
  pagamentos: z.object({
    vencidos: z.array(pagamento).describe('Pendentes com vencimento antes do dia'),
    aVencer: z.array(pagamento).describe(`Pendentes que vencem do dia até ${DIAS_A_VENCER} dias depois`),
    totalVencidoCentavos: z.number().int(),
    totalAVencerCentavos: z.number().int(),
  }),
});

module.exports = { filtro, painel, DIAS_A_VENCER };
