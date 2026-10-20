const { DateTime } = require('luxon');
const db = require('../../config/db');
const { hoje } = require('../../lib/tempo');
const { naoEncontrado, requisicaoInvalida } = require('../../lib/erros');

const COLUNAS = [
  'id',
  'nome',
  'dose',
  'observacoes',
  'ativo',
  'dataInicio',
  'dataFim',
  'intervaloHoras',
  'criadoEm',
  'atualizadoEm',
];
const COLUNAS_HORARIO = ['id', 'medicamentoId', 'periodo', 'hora', 'diaSemana'];

// Manhã, tarde, noite e por último os semanais; dentro do período, pela hora.
const ordemHorario = (prefixo) =>
  `array_position(ARRAY['manha','tarde','noite','semanal'], ${prefixo}periodo), ${prefixo}hora NULLS LAST, ${prefixo}dia_semana`;

// 0 = domingo ... 6 = sábado (Luxon usa 1 = segunda ... 7 = domingo).
const diaDaSemana = (dataISO) => DateTime.fromISO(dataISO).weekday % 7;

const camposGravaveis = (d) => ({
  nome: d.nome,
  dose: d.dose,
  observacoes: d.observacoes,
  ativo: d.ativo,
  dataInicio: d.dataInicio,
  dataFim: d.dataFim,
  intervaloHoras: d.intervaloHoras,
});

const camposHorario = (h) => ({ periodo: h.periodo, hora: h.hora, diaSemana: h.diaSemana });

async function cancelarLembretesPendentes(conexao, horarioIds) {
  if (!horarioIds.length) return;
  await conexao('lembreteEnvio')
    .where({ origemTipo: 'medicamento_horario', status: 'pendente' })
    .whereIn('origemId', horarioIds)
    .update({ status: 'cancelado' });
}

async function comHorarios(conexao, medicamentos) {
  if (!medicamentos.length) return [];
  const horarios = await conexao('medicamentoHorario')
    .select(COLUNAS_HORARIO)
    .whereIn(
      'medicamentoId',
      medicamentos.map((m) => m.id),
    )
    .orderByRaw(ordemHorario(''));
  return medicamentos.map((m) => ({
    ...m,
    horarios: horarios
      .filter((h) => h.medicamentoId === m.id)
      .map((h) => ({ id: h.id, periodo: h.periodo, hora: h.hora, diaSemana: h.diaSemana })),
  }));
}

async function listar(usuarioId) {
  const medicamentos = await db('medicamento').select(COLUNAS).where({ usuarioId }).orderBy('nome');
  return comHorarios(db, medicamentos);
}

async function buscar(usuarioId, id, conexao = db) {
  const medicamento = await conexao('medicamento').select(COLUNAS).where({ id, usuarioId }).first();
  if (!medicamento) throw naoEncontrado('Medicamento');
  const [completo] = await comHorarios(conexao, [medicamento]);
  return completo;
}

async function criar(usuarioId, dados) {
  return db.transaction(async (trx) => {
    const [{ id }] = await trx('medicamento')
      .insert({ ...camposGravaveis(dados), usuarioId })
      .returning('id');
    await trx('medicamentoHorario').insert(
      dados.horarios.map((h) => ({ ...camposHorario(h), medicamentoId: id })),
    );
    return buscar(usuarioId, id, trx);
  });
}

// Horários com `id` são mantidos (preservando o histórico de "tomei"); sem `id` são novos;
// os existentes que não vierem na lista são removidos.
async function atualizar(usuarioId, id, dados) {
  return db.transaction(async (trx) => {
    const alterados = await trx('medicamento').where({ id, usuarioId }).update(camposGravaveis(dados));
    if (!alterados) throw naoEncontrado('Medicamento');

    const existentes = (await trx('medicamentoHorario').where({ medicamentoId: id }).select('id')).map(
      (h) => h.id,
    );
    const mantidos = new Set();
    for (const [indice, h] of dados.horarios.entries()) {
      if (!h.id) {
        await trx('medicamentoHorario').insert({ ...camposHorario(h), medicamentoId: id });
      } else if (existentes.includes(h.id)) {
        await trx('medicamentoHorario').where({ id: h.id }).update(camposHorario(h));
        mantidos.add(h.id);
      } else {
        throw requisicaoInvalida(`horarios.${indice}.id: horário não encontrado neste medicamento.`);
      }
    }
    const removidos = existentes.filter((h) => !mantidos.has(h));
    if (removidos.length) await trx('medicamentoHorario').whereIn('id', removidos).del();

    await cancelarLembretesPendentes(trx, existentes);
    return buscar(usuarioId, id, trx);
  });
}

async function remover(usuarioId, id) {
  await db.transaction(async (trx) => {
    const horarios = await trx('medicamentoHorario as h')
      .join('medicamento as m', 'm.id', 'h.medicamentoId')
      .where({ 'm.id': id, 'm.usuarioId': usuarioId })
      .select('h.id');
    const apagados = await trx('medicamento').where({ id, usuarioId }).del();
    if (!apagados) throw naoEncontrado('Medicamento');
    await cancelarLembretesPendentes(
      trx,
      horarios.map((h) => h.id),
    );
  });
}

// Horários do usuário com o status de "tomado" no dia. O "não tomado" (✗) fica em tarefa_registro,
// como nas outras categorias da tela Hoje.
const itensDoDia = (usuarioId, data) =>
  db('medicamentoHorario as h')
    .join('medicamento as m', 'm.id', 'h.medicamentoId')
    .leftJoin('medicamentoRegistro as r', (j) =>
      j.on('r.medicamentoHorarioId', 'h.id').andOn('r.data', db.raw('?::date', [data])),
    )
    .where('m.usuarioId', usuarioId)
    .select(
      'h.id as horarioId',
      'm.id as medicamentoId',
      'm.nome',
      'm.dose',
      'm.observacoes',
      'h.periodo',
      'h.hora',
      'h.diaSemana',
      'r.tomadoEm',
      'm.dataInicio',
      'm.dataFim',
      db.raw(
        `EXISTS (SELECT 1 FROM tarefa_registro t
          WHERE t.usuario_id = m.usuario_id AND t.categoria = 'remedio' AND t.item_id = h.id
            AND t.data_ocorrencia = ?::date AND t.status = 'nao_feito') AS nao_tomado`,
        [data],
      ),
    )
    .orderByRaw(ordemHorario('h.'))
    .orderBy('m.nome');

function formatarItem(data, linha) {
  return {
    horarioId: linha.horarioId,
    medicamentoId: linha.medicamentoId,
    nome: linha.nome,
    dose: linha.dose,
    observacoes: linha.observacoes,
    periodo: linha.periodo,
    hora: linha.hora,
    data,
    tomado: Boolean(linha.tomadoEm),
    tomadoEm: linha.tomadoEm ?? null,
    situacao: linha.tomadoEm ? 'tomado' : linha.naoTomado ? 'nao_tomado' : 'pendente',
  };
}

// Sem início ou fim, o remédio vale para qualquer dia (como antes da migration 29).
const noPeriodo = (data, { dataInicio, dataFim }) =>
  (!dataInicio || dataInicio <= data) && (!dataFim || dataFim >= data);

const limparNaoTomado = (conexao, usuarioId, horarioId, data) =>
  conexao('tarefaRegistro')
    .where({ usuarioId, categoria: 'remedio', itemId: horarioId, dataOcorrencia: data })
    .del();

async function doDia(usuarioId, { data = hoje() } = {}) {
  const linhas = await itensDoDia(usuarioId, data)
    .where('m.ativo', true)
    .where((w) => w.whereNot('h.periodo', 'semanal').orWhere('h.diaSemana', diaDaSemana(data)));
  return linhas.filter((linha) => noPeriodo(data, linha)).map((linha) => formatarItem(data, linha));
}

/** Marca a dose: `situacao` (tomado, nao_tomado, pendente) ou, sem ela, `tomado` (false = pendente). */
async function registrar(usuarioId, { horarioId, data = hoje(), tomado, situacao }) {
  const nova = situacao ?? (tomado ? 'tomado' : 'pendente');
  const item = await itensDoDia(usuarioId, data).where('h.id', horarioId).first();
  if (!item) throw naoEncontrado('Horário');
  if (item.periodo === 'semanal' && item.diaSemana !== diaDaSemana(data)) {
    throw requisicaoInvalida('data: este remédio semanal não é tomado nesse dia da semana.');
  }
  if (!noPeriodo(data, item)) {
    throw requisicaoInvalida('data: este dia está fora do período de uso do remédio.');
  }

  await db.transaction(async (trx) => {
    await limparNaoTomado(trx, usuarioId, horarioId, data);
    if (nova === 'tomado') {
      await trx('medicamentoRegistro')
        .insert({ medicamentoHorarioId: horarioId, data })
        .onConflict(['medicamentoHorarioId', 'data'])
        .ignore();
    } else {
      await trx('medicamentoRegistro').where({ medicamentoHorarioId: horarioId, data }).del();
    }
    if (nova === 'nao_tomado') {
      await trx('tarefaRegistro').insert({
        usuarioId,
        categoria: 'remedio',
        itemId: horarioId,
        dataOcorrencia: data,
        horario: item.hora,
        status: 'nao_feito',
      });
    }
  });

  const atualizado = await itensDoDia(usuarioId, data).where('h.id', horarioId).first();
  return formatarItem(data, atualizado);
}

module.exports = { listar, buscar, criar, atualizar, remover, doDia, registrar };
