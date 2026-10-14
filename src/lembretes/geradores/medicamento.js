// Remédios: um lembrete na hora de cada dose (horários com hora, de remédios em uso).
const { instante, naData, diasEntre, juntar } = require('../textos');

const tipo = 'medicamento_horario';

// 0 = domingo ... 6 = sábado, como em dia_semana.
const diaDaSemana = (data) => naData(data, '00:00').weekday % 7;

async function gerar(conexao, { de, ate, usuarios }) {
  const horarios = await conexao('medicamentoHorario as h')
    .join('medicamento as m', 'm.id', 'h.medicamentoId')
    .whereIn('m.usuarioId', usuarios)
    .where('m.ativo', true)
    .whereNotNull('h.hora')
    .select('h.id', 'm.usuarioId', 'h.periodo', 'h.hora', 'h.diaSemana');

  return diasEntre(de, ate).flatMap((data) =>
    horarios
      .filter((h) => h.periodo !== 'semanal' || h.diaSemana === diaDaSemana(data))
      .map((h) => ({ ...h, momento: naData(data, h.hora) }))
      .filter(({ momento }) => momento >= de && momento < ate)
      .map(({ id, usuarioId, momento }) => ({ usuarioId, origemId: id, ocorrencia: momento, agendadoPara: momento })),
  );
}

// Não lembra de dose já marcada como tomada, nem de remédio pausado.
async function mensagem(conexao, lembrete) {
  const data = instante(lembrete.ocorrencia).toISODate();
  const dose = await conexao('medicamentoHorario as h')
    .join('medicamento as m', 'm.id', 'h.medicamentoId')
    .leftJoin('medicamentoRegistro as r', (j) =>
      j.on('r.medicamentoHorarioId', 'h.id').andOn('r.data', conexao.raw('?::date', [data])),
    )
    .where('h.id', lembrete.origemId)
    .first('m.nome', 'm.dose', 'm.observacoes', 'm.ativo', 'r.tomadoEm');
  if (!dose || !dose.ativo || dose.tomadoEm) return null;
  return {
    titulo: `Hora do remédio: ${dose.nome}`,
    corpo: juntar(dose.dose, dose.observacoes) || 'Toque para marcar que tomou.',
    url: '/remedios',
  };
}

module.exports = { tipo, gerar, mensagem };
