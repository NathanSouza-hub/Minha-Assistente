// Geradores de lembrete, um por origem (lembrete_envio.origem_tipo). Cada um tem:
// - gerar(conexao, { de, ate, usuarios }): lembretes com agendadoPara em [de, ate);
// - mensagem(conexao, lembrete): { titulo, corpo, url } na hora de enviar, ou null se o lembrete
//   deixou de valer (origem apagada, remédio já tomado, conta paga...).
const geradores = [
  require('./evento'),
  require('./medicamento'),
  require('./rotina'),
  require('./pagamento'),
];

const porTipo = Object.fromEntries(geradores.map((g) => [g.tipo, g]));

module.exports = { geradores, porTipo };
