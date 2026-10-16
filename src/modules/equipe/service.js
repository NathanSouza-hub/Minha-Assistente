const db = require('../../config/db');
const comprovantes = require('../pagamentos/comprovantes');
const { hoje } = require('../../lib/tempo');
const { AppError, naoEncontrado } = require('../../lib/erros');
const { garantirContas, apagarFuturas, cancelarLembretes } = require('./contas');

const CAMPOS = ['id', 'nome', 'funcao', 'formaPagamento', 'chavePix', 'ativo'];

const naoAchou = () => naoEncontrado('Pessoa', { feminino: true });

async function comDias(conexao, membros) {
  if (!membros.length) return [];
  const dias = await conexao('membroEquipeDia')
    .whereIn(
      'membroId',
      membros.map((m) => m.id),
    )
    .orderBy('dia')
    .select('membroId', 'dia', 'valorPrevistoCentavos');
  return membros.map((m) => ({
    ...m,
    dias: dias.filter((d) => d.membroId === m.id).map(({ dia, valorPrevistoCentavos }) => ({ dia, valorPrevistoCentavos })),
  }));
}

// Ativas primeiro, depois por nome.
async function listar(usuarioId) {
  const membros = await db('membroEquipe')
    .select(CAMPOS)
    .where({ usuarioId })
    .orderBy([{ column: 'ativo', order: 'desc' }, { column: 'nome' }]);
  return comDias(db, membros);
}

async function buscar(usuarioId, id, conexao = db) {
  const membro = await conexao('membroEquipe').select(CAMPOS).where({ id, usuarioId }).first();
  if (!membro) throw naoAchou();
  const [comOsDias] = await comDias(conexao, [membro]);
  return comOsDias;
}

async function comDuplicado(operacao) {
  try {
    return await operacao();
  } catch (erro) {
    if (erro.code === '23505' && erro.constraint === 'membro_equipe_usuario_nome_unique') {
      throw new AppError(409, 'MEMBRO_DUPLICADO', 'Já existe uma pessoa com esse nome na equipe.');
    }
    throw erro;
  }
}

const camposMembro = (d) => ({
  nome: d.nome,
  funcao: d.funcao,
  formaPagamento: d.formaPagamento,
  chavePix: d.chavePix,
  ativo: d.ativo,
});

const gravarDias = (trx, membroId, dias) =>
  trx('membroEquipeDia').insert(
    dias.map(({ dia, valorPrevistoCentavos }) => ({ membroId, dia, valorPrevistoCentavos, desde: hoje() })),
  );

const criar = (usuarioId, dados) =>
  comDuplicado(() =>
    db.transaction(async (trx) => {
      const [{ id }] = await trx('membroEquipe').insert({ ...camposMembro(dados), usuarioId }).returning('id');
      await gravarDias(trx, id, dados.dias);
      await garantirContas(trx, usuarioId);
      return buscar(usuarioId, id, trx);
    }),
  );

const mesmosDias = (a, b) =>
  a.length === b.length &&
  a.every((d, i) => d.dia === b[i].dia && d.valorPrevistoCentavos === b[i].valorPrevistoCentavos);

// Mudar dias/valores ou desativar refaz as contas futuras pendentes; reativar volta a criar só a
// partir de hoje (sem contas vencidas do tempo em que a pessoa esteve inativa).
const atualizar = (usuarioId, id, dados) =>
  comDuplicado(() =>
    db.transaction(async (trx) => {
      const atual = await buscar(usuarioId, id, trx);
      await trx('membroEquipe').where({ id, usuarioId }).update(camposMembro(dados));

      const diasMudaram = !mesmosDias(atual.dias, dados.dias);
      if (diasMudaram) {
        await trx('membroEquipeDia').where({ membroId: id }).del();
        await gravarDias(trx, id, dados.dias);
      } else if (!atual.ativo && dados.ativo) {
        await trx('membroEquipeDia').where({ membroId: id }).update({ desde: hoje() });
      }
      if (diasMudaram || atual.ativo !== dados.ativo) await apagarFuturas(trx, id);
      if (atual.nome !== dados.nome) {
        await trx('pagamento').where({ membroId: id, status: 'pendente' }).update({ descricao: dados.nome });
      }

      await garantirContas(trx, usuarioId);
      return buscar(usuarioId, id, trx);
    }),
  );

// Quem já recebeu fica no histórico: em vez de excluir, desative.
async function remover(usuarioId, id) {
  await db.transaction(async (trx) => {
    await buscar(usuarioId, id, trx);
    if (await trx('pagamento').where({ membroId: id, status: 'pago' }).first('id')) {
      throw new AppError(
        409,
        'REFERENCIA_INVALIDA',
        'Essa pessoa já recebeu pagamentos. Desative em vez de excluir, para manter o histórico.',
      );
    }
    await comprovantes.aoApagarContas(trx, await trx('pagamento').where({ membroId: id }).pluck('id'));
    const apagadas = await trx('pagamento').where({ membroId: id }).del().returning('id');
    await cancelarLembretes(trx, apagadas.map((c) => c.id));
    await trx('membroEquipe').where({ id, usuarioId }).del();
  });
}

module.exports = { listar, buscar, criar, atualizar, remover };
