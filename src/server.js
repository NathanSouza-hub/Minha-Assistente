const env = require('./config/env');
const db = require('./config/db');
const { criarApp } = require('./app');
const { iniciarAgendador } = require('./lembretes/agendador');
const { canaisAtivos } = require('./lembretes/canais');
const { iniciarManutencao } = require('./jobs/manutencao');

const servidor = criarApp().listen(env.PORT, () => {
  console.log(`Minha Assistente API ouvindo em http://localhost:${env.PORT} (docs em /docs)`);
});

// Lembretes rodam no mesmo processo da API (um processo só: o envio trava as linhas, então dois
// também não duplicam, mas geram trabalho em dobro).
const pararLembretes = canaisAtivos().length ? iniciarAgendador() : null;
const pararManutencao = iniciarManutencao();
if (!pararLembretes) {
  console.log('Lembretes desligados: defina as chaves VAPID_* (app) ou as WHATSAPP_* (WhatsApp).');
}

function encerrar(sinal) {
  console.log(`${sinal} recebido, encerrando...`);
  pararLembretes?.();
  pararManutencao();
  servidor.close(async () => {
    await db.destroy();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));
