// Cria uma conta quando o cadastro pelo app está fechado (CADASTRO_ABERTO).
//   Local:    npm run conta:criar -- maria@exemplo.com "Maria Silva"
//   Servidor: docker compose exec api node src/cli/criar-conta.js maria@exemplo.com "Maria Silva"
// Mostra uma senha temporária para passar à pessoa, que a troca em Mais → Trocar senha.
const db = require('../config/db');
const { criarConta } = require('../modules/auth/service');

async function principal() {
  const [email, ...partesNome] = process.argv.slice(2);
  const nome = partesNome.join(' ');
  if (!email || !nome) {
    console.error('Uso: node src/cli/criar-conta.js <e-mail> <nome>');
    return 1;
  }
  try {
    const { usuario, senha } = await criarConta({ nome, email });
    console.log(`Conta de ${usuario.nome} (${usuario.email}) criada.`);
    console.log(`Senha temporária: ${senha}`);
    console.log('A pessoa entra com essa senha e troca em Mais → Trocar senha.');
    return 0;
  } catch (erro) {
    console.error(erro.issues ? erro.issues.map((i) => i.message).join('\n') : erro.message);
    return 1;
  } finally {
    await db.destroy();
  }
}

principal().then((codigo) => {
  process.exitCode = codigo;
});
