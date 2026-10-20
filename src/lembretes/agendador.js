// Agendador de lembretes (seção "Lembretes" de docs/arquitetura.md). A cada minuto:
// 1. gera os lembretes das próximas 24h (upsert em lembrete_envio, uma linha por canal ativo);
// 2. envia os pendentes que já venceram.
const { DateTime } = require('luxon');
const db = require('../config/db');
const { agora: agoraSP, paraISO } = require('../lib/tempo');
const { geradores, porTipo } = require('./geradores');
const { canaisAtivos } = require('./canais');
const { CATEGORIA_DA_ORIGEM } = require('./categorias');

const HORIZONTE_HORAS = 24;
// Lembrete que passou da hora há mais que isso (ex.: servidor parado) não é mais enviado.
const TOLERANCIA_MINUTOS = 15;
const MAXIMO_TENTATIVAS = 3;
const LOTE = 200;

const CHAVE = ['origemTipo', 'origemId', 'ocorrencia', 'agendadoPara', 'canal'];

/** Quem tem o canal e não desligou a categoria desta origem (Notificações → O que avisar). */
function quemRecebe(canal, origemTipo) {
  const categoria = CATEGORIA_DA_ORIGEM[origemTipo];
  const doCanal = canal.usuarios(db);
  if (!categoria) return doCanal;
  return db('usuario').whereIn('id', doCanal).whereRaw('NOT (? = ANY(avisos_desligados))', [categoria]).select('id');
}

/**
 * Cria os lembretes com agendadoPara de agora até 24h depois. Os que já existem ficam como estão,
 * exceto os cancelados, que voltam a pendentes: editar a origem cancela os pendentes dela, e os
 * horários que continuam valendo voltam aqui.
 */
async function gerar(agora = agoraSP(), { canais = canaisAtivos() } = {}) {
  const de = agora.startOf('minute');
  const ate = de.plus({ hours: HORIZONTE_HORAS });
  let total = 0;
  for (const canal of canais) {
    for (const gerador of geradores) {
      const itens = await gerador.gerar(db, { de, ate, usuarios: quemRecebe(canal, gerador.tipo) });
      const linhas = itens.map((i) => ({
        usuarioId: i.usuarioId,
        origemTipo: gerador.tipo,
        origemId: i.origemId,
        ocorrencia: paraISO(i.ocorrencia),
        agendadoPara: paraISO(i.agendadoPara),
        canal: canal.nome,
      }));
      for (let i = 0; i < linhas.length; i += 500) {
        await db('lembreteEnvio')
          .insert(linhas.slice(i, i + 500))
          .onConflict(CHAVE)
          .merge({ status: 'pendente', erro: null, tentativas: 0 })
          .where('lembreteEnvio.status', 'cancelado');
      }
      total += linhas.length;
    }
  }
  return total;
}

/** Envia um lembrete vencido, travando a linha (dois processos não enviam o mesmo). */
async function enviarUm(id, agora, canais) {
  return db.transaction(async (trx) => {
    const lembrete = await trx('lembreteEnvio').where({ id, status: 'pendente' }).forUpdate().skipLocked().first();
    if (!lembrete) return null;

    const atualizar = (campos) => trx('lembreteEnvio').where({ id }).update(campos);
    const cancelar = async (motivo) => {
      await atualizar({ status: 'cancelado', erro: motivo });
      return 'cancelado';
    };

    if (agora.diff(DateTime.fromISO(lembrete.agendadoPara), 'minutes').minutes > TOLERANCIA_MINUTOS) {
      return cancelar('Passou da hora: não foi enviado.');
    }
    const canal = canais.find((c) => c.nome === lembrete.canal);
    if (!canal) return cancelar('Canal desligado.');
    // A pessoa pode ter desligado a categoria depois de o lembrete ser gerado.
    const categoria = CATEGORIA_DA_ORIGEM[lembrete.origemTipo];
    if (categoria) {
      const { avisosDesligados } = await trx('usuario').where({ id: lembrete.usuarioId }).first('avisosDesligados');
      if (avisosDesligados.includes(categoria)) return cancelar('Aviso desta categoria desligado.');
    }
    const mensagem = await porTipo[lembrete.origemTipo].mensagem(trx, lembrete);
    if (!mensagem) return cancelar('Não vale mais (a origem mudou ou já foi resolvida).');

    // A tag faz um aviso repetido substituir o anterior no aparelho, em vez de empilhar.
    const tag = `${lembrete.origemTipo}:${lembrete.origemId}:${lembrete.ocorrencia}`;
    try {
      const resultado = await canal.enviar(trx, lembrete.usuarioId, { ...mensagem, tag });
      if (!resultado.entregue) return cancelar(resultado.motivo);
    } catch (erro) {
      const tentativas = lembrete.tentativas + 1;
      const status = tentativas >= MAXIMO_TENTATIVAS ? 'falhou' : 'pendente';
      await atualizar({ tentativas, status, erro: String(erro?.message ?? erro).slice(0, 500) });
      return status;
    }
    await atualizar({ status: 'enviado', enviadoEm: paraISO(agora), erro: null });
    return 'enviado';
  });
}

/** Envia os pendentes com agendadoPara até agora. Devolve quantos terminaram em cada status. */
async function enviarPendentes(agora = agoraSP(), { canais = canaisAtivos() } = {}) {
  const ids = await db('lembreteEnvio')
    .where('status', 'pendente')
    .where('agendadoPara', '<=', paraISO(agora))
    .orderBy('agendadoPara')
    .limit(LOTE)
    .pluck('id');
  const contagem = {};
  for (const id of ids) {
    const status = await enviarUm(id, agora, canais);
    if (status) contagem[status] = (contagem[status] ?? 0) + 1;
  }
  return contagem;
}

async function executarCiclo(agora = agoraSP(), opcoes = {}) {
  const canais = opcoes.canais ?? canaisAtivos();
  if (!canais.length) return { gerados: 0, enviados: {} };
  const gerados = await gerar(agora, { canais });
  const enviados = await enviarPendentes(agora, { canais });
  return { gerados, enviados };
}

/** Roda um ciclo agora e depois a cada minuto. Devolve a função que para o agendador. */
function iniciarAgendador({ intervaloMs = 60_000, aoErrar = (e) => console.error('[lembretes]', e) } = {}) {
  let rodando = false;
  const ciclo = async () => {
    if (rodando) return; // o anterior ainda não terminou
    rodando = true;
    try {
      await executarCiclo();
    } catch (erro) {
      aoErrar(erro);
    } finally {
      rodando = false;
    }
  };
  ciclo();
  const timer = setInterval(ciclo, intervaloMs);
  return () => clearInterval(timer);
}

module.exports = { gerar, enviarPendentes, executarCiclo, iniciarAgendador, TOLERANCIA_MINUTOS, MAXIMO_TENTATIVAS };
