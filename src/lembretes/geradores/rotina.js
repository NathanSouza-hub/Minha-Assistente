// Rotina: tarefas ativas com `lembrete`, na hora marcada, nos dias da semana delas.
const { instante, naData, diasEntre } = require('../textos');

const tipo = 'rotina';

const diaDaSemana = (data) => naData(data, '00:00').weekday % 7;

async function gerar(conexao, { de, ate, usuarios }) {
  const rotinas = await conexao('rotina')
    .whereIn('usuarioId', usuarios)
    .where({ ativo: true, lembrete: true })
    .whereNotNull('hora')
    .select('id', 'usuarioId', 'hora', 'diasSemana');

  return diasEntre(de, ate).flatMap((data) =>
    rotinas
      .filter((r) => r.diasSemana.includes(diaDaSemana(data)))
      .map((r) => ({ ...r, momento: naData(data, r.hora) }))
      .filter(({ momento }) => momento >= de && momento < ate)
      .map(({ id, usuarioId, momento }) => ({ usuarioId, origemId: id, ocorrencia: momento, agendadoPara: momento })),
  );
}

// Não lembra de tarefa já feita no dia (nem de tarefa pausada ou sem lembrete).
async function mensagem(conexao, lembrete) {
  const data = instante(lembrete.ocorrencia).toISODate();
  const tarefa = await conexao('rotina as t')
    .leftJoin('rotinaConclusao as c', (j) => j.on('c.rotinaId', 't.id').andOn('c.data', conexao.raw('?::date', [data])))
    .where('t.id', lembrete.origemId)
    .first('t.titulo', 't.hora', 't.ativo', 't.lembrete', 'c.concluidaEm');
  if (!tarefa || !tarefa.ativo || !tarefa.lembrete || tarefa.concluidaEm) return null;
  return { titulo: tarefa.titulo, corpo: `Tarefa da rotina, às ${tarefa.hora}.`, url: '/rotina' };
}

module.exports = { tipo, gerar, mensagem };
