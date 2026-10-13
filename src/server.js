const env = require('./config/env');
const db = require('./config/db');
const { criarApp } = require('./app');

const servidor = criarApp().listen(env.PORT, () => {
  console.log(`Minha Assistente API ouvindo em http://localhost:${env.PORT} (docs em /docs)`);
});

function encerrar(sinal) {
  console.log(`${sinal} recebido, encerrando...`);
  servidor.close(async () => {
    await db.destroy();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));
