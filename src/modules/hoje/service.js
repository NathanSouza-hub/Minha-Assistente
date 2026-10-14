// Painel do dia: junta o que já existe nos outros módulos, com as mesmas regras.
const { DateTime } = require('luxon');
const { hoje } = require('../../lib/tempo');
const eventos = require('../eventos/service');
const medicamentos = require('../medicamentos/service');
const rotinas = require('../rotinas/service');
const pagamentos = require('../pagamentos/service');
const { DIAS_A_VENCER } = require('./schema');

const somarDias = (dataISO, dias) => DateTime.fromISO(dataISO).plus({ days: dias }).toISODate();
const total = (lista) => lista.reduce((soma, p) => soma + p.valorCentavos, 0);

async function painel(usuarioId, { data = hoje() } = {}) {
  const [doDiaEventos, doDiaRemedios, doDiaRotina, vencidos, aVencer] = await Promise.all([
    eventos.listar(usuarioId, { inicio: data, fim: data }),
    medicamentos.doDia(usuarioId, { data }),
    rotinas.doDia(usuarioId, { data }),
    pagamentos.listar(usuarioId, { status: 'pendente', fim: somarDias(data, -1) }),
    pagamentos.listar(usuarioId, { status: 'pendente', inicio: data, fim: somarDias(data, DIAS_A_VENCER) }),
  ]);

  return {
    data,
    resumo: {
      eventos: doDiaEventos.length,
      remediosPendentes: doDiaRemedios.filter((r) => !r.tomado).length,
      tarefasPendentes: doDiaRotina.filter((t) => !t.concluida).length,
      pagamentosVencidos: vencidos.length,
      pagamentosAVencer: aVencer.length,
    },
    eventos: doDiaEventos,
    medicamentos: doDiaRemedios,
    rotina: doDiaRotina,
    pagamentos: {
      vencidos,
      aVencer,
      totalVencidoCentavos: total(vencidos),
      totalAVencerCentavos: total(aVencer),
    },
  };
}

module.exports = { painel };
