// Contas da equipe: o app garante a conta de cada dia de pagamento de cada pessoa ativa no mês
// atual e no seguinte. Idempotente (unique (membro_id, vencimento) + ON CONFLICT), então pode
// rodar a cada listagem de contas.
const { hoje } = require('../../lib/tempo');
const comprovantes = require('../pagamentos/comprovantes');

// Dia que não existe no mês (31 em fevereiro) vira o último dia. Só nasce conta a partir de
// `desde` (data em que o dia foi cadastrado) e nunca num dia que a pessoa dispensou.
const SQL_GARANTIR = `
  INSERT INTO pagamento (usuario_id, membro_id, descricao, valor_centavos, vencimento)
  SELECT m.usuario_id, m.id, m.nome, d.valor_previsto_centavos, v.vencimento
  FROM membro_equipe m
  JOIN membro_equipe_dia d ON d.membro_id = m.id
  CROSS JOIN LATERAL (
    SELECT mes + (LEAST(d.dia, extract(day FROM mes + interval '1 month' - interval '1 day')::int) - 1) AS vencimento
    FROM (VALUES (date_trunc('month', ?::date)::date),
                 ((date_trunc('month', ?::date) + interval '1 month')::date)) AS meses(mes)
  ) v
  WHERE m.usuario_id = ? AND m.ativo AND v.vencimento >= d.desde
    AND NOT EXISTS (
      SELECT 1 FROM membro_equipe_dispensa x WHERE x.membro_id = m.id AND x.vencimento = v.vencimento
    )
  ON CONFLICT (membro_id, vencimento) DO NOTHING`;

const garantirContas = (conexao, usuarioId, dataDeHoje = hoje()) =>
  conexao.raw(SQL_GARANTIR, [dataDeHoje, dataDeHoje, usuarioId]);

// Lembretes ainda não enviados das contas apagadas deixam de valer.
const cancelarLembretes = (conexao, ids) =>
  ids.length
    ? conexao('lembreteEnvio')
        .where({ origemTipo: 'pagamento', status: 'pendente' })
        .whereIn('origemId', ids)
        .update({ status: 'cancelado' })
    : null;

// Apaga as contas pendentes da pessoa que vencem de hoje em diante (e as dispensas desse período),
// para o cadastro novo valer nelas. Vencidas e pagas ficam.
async function apagarFuturas(trx, membroId, dataDeHoje = hoje()) {
  const futuras = trx('pagamento').where({ membroId, status: 'pendente' }).where('vencimento', '>=', dataDeHoje);
  await comprovantes.aoApagarContas(trx, await futuras.clone().pluck('id'));
  const apagadas = await futuras.del().returning('id');
  await cancelarLembretes(trx, apagadas.map((c) => c.id));
  await trx('membroEquipeDispensa').where({ membroId }).where('vencimento', '>=', dataDeHoje).del();
}

// Conta da equipe apagada ou mudada de dia: o dia original não é criado de novo.
const dispensar = (conexao, membroId, vencimento) =>
  conexao('membroEquipeDispensa').insert({ membroId, vencimento }).onConflict(['membroId', 'vencimento']).ignore();

module.exports = { garantirContas, apagarFuturas, dispensar, cancelarLembretes };
