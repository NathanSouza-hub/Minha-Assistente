// Pagamentos pendentes: lembrete na véspera e no dia do vencimento, às 9h.
const { instante, naData, diasEntre, formatarCentavos, juntar } = require('../textos');

const tipo = 'pagamento';

const HORA = '09:00';
const DIAS_ANTES = [1, 0];

async function gerar(conexao, { de, ate, usuarios }) {
  const dias = diasEntre(de, ate);
  const ultimo = naData(dias.at(-1), '00:00').plus({ days: Math.max(...DIAS_ANTES) }).toISODate();
  const pagamentos = await conexao('pagamento')
    .whereIn('usuarioId', usuarios)
    .where('status', 'pendente')
    .whereBetween('vencimento', [dias[0], ultimo])
    .select('id', 'usuarioId', 'vencimento');

  return pagamentos.flatMap((p) => {
    const vencimento = naData(p.vencimento, '00:00');
    return DIAS_ANTES.map((antes) => naData(vencimento.minus({ days: antes }).toISODate(), HORA))
      .filter((agendado) => agendado >= de && agendado < ate)
      .map((agendadoPara) => ({ usuarioId: p.usuarioId, origemId: p.id, ocorrencia: vencimento, agendadoPara }));
  });
}

// Não lembra de conta já paga, nem se o vencimento mudou depois de o lembrete ser gerado.
async function mensagem(conexao, lembrete) {
  const p = await conexao('pagamento')
    .where({ id: lembrete.origemId })
    .first('descricao', 'valorCentavos', 'vencimento', 'status');
  const vencimento = instante(lembrete.ocorrencia).toISODate();
  if (!p || p.status !== 'pendente' || p.vencimento !== vencimento) return null;
  const hoje = instante(lembrete.agendadoPara).toISODate() === vencimento;
  return {
    titulo: hoje ? 'Conta vence hoje' : 'Conta vence amanhã',
    corpo: juntar(p.descricao, formatarCentavos(p.valorCentavos)),
    url: '/pagamentos',
  };
}

module.exports = { tipo, gerar, mensagem };
