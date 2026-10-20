// Resumo da manhã: um aviso por dia, na hora escolhida pela pessoa (usuario.resumo_hora), com o
// que o painel Hoje mostra. origem_id = o próprio usuário. O texto é montado na hora de enviar.
const { instante, naData, diasEntre, formatarCentavos, juntar } = require('../textos');
const { painel } = require('../../modules/hoje/service');

const tipo = 'resumo';

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const horaDe = (iso) => instante(iso).toFormat('HH:mm');

async function gerar(conexao, { de, ate, usuarios }) {
  const pessoas = await conexao('usuario')
    .whereIn('id', usuarios)
    .where('resumoAtivo', true)
    .select('id', 'resumoHora');
  return diasEntre(de, ate).flatMap((data) =>
    pessoas
      .map((p) => ({ usuarioId: p.id, momento: naData(data, p.resumoHora) }))
      .filter(({ momento }) => momento >= de && momento < ate)
      .map(({ usuarioId, momento }) => ({ usuarioId, origemId: usuarioId, ocorrencia: momento, agendadoPara: momento })),
  );
}

/**
 * "2 agendamentos (o 1º às 09:00) · 3 remédios · 4 compromissos · Conta de luz vence hoje
 * (R$ 120,00) · 1 conta vencida". null se não há nada no dia (não incomoda à toa).
 */
function textoDoResumo({ data, eventos, medicamentos, rotina, pagamentos }) {
  const remedios = medicamentos.filter((m) => !m.tomado).length;
  const compromissos = rotina.filter((t) => !t.concluida).length;
  const vencemHoje = pagamentos.aVencer.filter((p) => p.vencimento === data);
  const totalHoje = vencemHoje.reduce((soma, p) => soma + p.valorCentavos, 0);

  const partes = [
    eventos.length === 1 && `${eventos[0].titulo} às ${horaDe(eventos[0].inicio)}`,
    eventos.length > 1 && `${eventos.length} agendamentos (o 1º às ${horaDe(eventos[0].inicio)})`,
    remedios > 0 && plural(remedios, 'remédio', 'remédios'),
    compromissos > 0 && plural(compromissos, 'compromisso', 'compromissos'),
    vencemHoje.length === 1 && `${vencemHoje[0].descricao} vence hoje (${formatarCentavos(totalHoje)})`,
    vencemHoje.length > 1 && `${vencemHoje.length} contas vencem hoje (${formatarCentavos(totalHoje)})`,
    pagamentos.vencidos.length > 0 && plural(pagamentos.vencidos.length, 'conta vencida', 'contas vencidas'),
  ];
  const corpo = juntar(...partes);
  return corpo ? { titulo: 'Bom dia! Seu dia hoje', corpo, url: '/hoje' } : null;
}

// Não envia se a pessoa desligou o resumo ou mudou o horário depois de o lembrete ser gerado.
async function mensagem(conexao, lembrete) {
  const pessoa = await conexao('usuario').where({ id: lembrete.origemId }).first('resumoAtivo', 'resumoHora');
  const momento = instante(lembrete.ocorrencia);
  if (!pessoa || !pessoa.resumoAtivo || pessoa.resumoHora !== momento.toFormat('HH:mm')) return null;
  return textoDoResumo(await painel(lembrete.origemId, { data: momento.toISODate() }));
}

module.exports = { tipo, gerar, mensagem, textoDoResumo };
