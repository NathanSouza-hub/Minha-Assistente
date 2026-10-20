// Tarefas avulsas com `lembrete`: um aviso no dia e na hora da tarefa.
const { instante, naData, diasEntre } = require('../textos');

const tipo = 'tarefa';

async function gerar(conexao, { de, ate, usuarios }) {
  const dias = diasEntre(de, ate);
  const tarefas = await conexao('tarefa')
    .whereIn('usuarioId', usuarios)
    .where({ lembrete: true })
    .whereNull('concluidaEm')
    .whereNotNull('hora')
    .whereBetween('data', [dias[0], dias.at(-1)])
    .select('id', 'usuarioId', 'data', 'hora');

  return tarefas
    .map((t) => ({ ...t, momento: naData(t.data, t.hora) }))
    .filter(({ momento }) => momento >= de && momento < ate)
    .map(({ id, usuarioId, momento }) => ({ usuarioId, origemId: id, ocorrencia: momento, agendadoPara: momento }));
}

// Não lembra de tarefa concluída, apagada, sem lembrete ou que mudou de dia/hora.
async function mensagem(conexao, lembrete) {
  const t = await conexao('tarefa')
    .where({ id: lembrete.origemId })
    .first('titulo', 'data', 'hora', 'lembrete', 'concluidaEm');
  if (!t || !t.lembrete || t.concluidaEm || !t.hora) return null;
  if (naData(t.data, t.hora).toMillis() !== instante(lembrete.ocorrencia).toMillis()) return null;
  return { titulo: t.titulo, corpo: `Tarefa de hoje, às ${t.hora}.`, url: '/hoje' };
}

module.exports = { tipo, gerar, mensagem };
