// Compromissos da agenda: um lembrete por valor de `lembretesMinutosAntes`, em cada ocorrência.
const { expandir } = require('../../lib/recorrencia');
const { instante, quando, juntar } = require('../textos');

const tipo = 'evento';

// Limite do esquema de eventos (30 dias antes): até onde olhar para frente.
const MAXIMO_MINUTOS_ANTES = 43_200;

async function gerar(conexao, { de, ate, usuarios }) {
  const linhas = await conexao('evento')
    .select('id', 'usuarioId', 'inicio', 'recorrencia', 'recorrenciaFim', 'lembretesMinutosAntes')
    .whereIn('usuarioId', usuarios)
    .whereRaw('cardinality(lembretes_minutos_antes) > 0')
    .where('inicio', '<', ate.plus({ minutes: MAXIMO_MINUTOS_ANTES }).toISO())
    .where((w) =>
      w
        .where((unico) => unico.where('recorrencia', 'nenhuma').where('inicio', '>=', de.toISO()))
        .orWhere((rec) =>
          rec
            .whereNot('recorrencia', 'nenhuma')
            .where((f) => f.whereNull('recorrenciaFim').orWhere('recorrenciaFim', '>=', de.toISODate())),
        ),
    );

  return linhas.flatMap((e) => {
    const antecedencia = Math.max(...e.lembretesMinutosAntes);
    const ocorrencias = expandir(
      { inicio: instante(e.inicio), duracaoMs: 0, recorrencia: e.recorrencia, ate: e.recorrenciaFim },
      de,
      ate.plus({ minutes: antecedencia }),
    );
    return ocorrencias.flatMap(({ inicio }) =>
      e.lembretesMinutosAntes
        .map((minutos) => inicio.minus({ minutes: minutos }))
        .filter((agendado) => agendado >= de && agendado < ate)
        .map((agendadoPara) => ({ usuarioId: e.usuarioId, origemId: e.id, ocorrencia: inicio, agendadoPara })),
    );
  });
}

// Editar ou excluir o evento já cancela os pendentes (eventos/service.js); aqui só falta o texto.
async function mensagem(conexao, lembrete) {
  const evento = await conexao('evento').select('titulo', 'local').where({ id: lembrete.origemId }).first();
  if (!evento) return null;
  return {
    titulo: evento.titulo,
    corpo: juntar(quando(instante(lembrete.ocorrencia), instante(lembrete.agendadoPara)), evento.local),
    url: '/agenda',
  };
}

module.exports = { tipo, gerar, mensagem };
