// Manutenção periódica no processo da API (independe das chaves de notificação): cria as contas
// da equipe do mês atual e do seguinte para todos e apaga os ids antigos de mensagens do WhatsApp. Assim nenhuma tela precisa gravar ao ser
// aberta, e a virada do mês não depende de alguém abrir as Finanças.
const db = require('../config/db');
const { garantirContasDeTodos } = require('../modules/equipe/contas');
const { limparMensagensAntigas } = require('../modules/whatsapp/entrada');

const INTERVALO_MS = 6 * 60 * 60 * 1000;

async function executar() {
  try {
    await garantirContasDeTodos(db);
  } catch (erro) {
    console.error('Manutenção: falha ao garantir as contas da equipe:', erro.message);
  }
  try {
    await limparMensagensAntigas(db);
  } catch (erro) {
    console.error('Manutenção: falha ao limpar as mensagens do WhatsApp:', erro.message);
  }
}

/** Roda já e a cada 6 horas. Devolve a função que para. */
function iniciarManutencao() {
  void executar();
  const timer = setInterval(executar, INTERVALO_MS);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { iniciarManutencao, executar };
