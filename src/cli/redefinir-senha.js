// Redefine a senha de quem esqueceu (enquanto não há redefinição por e-mail).
//   Local:    npm run senha:redefinir -- maria@exemplo.com
//   Servidor: docker compose exec api node src/cli/redefinir-senha.js maria@exemplo.com
// Mostra uma senha temporária para passar à pessoa; todas as sessões dela são encerradas.
const db = require('../config/db');
const { redefinirSenha } = require('../modules/auth/service');

async function principal() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Uso: node src/cli/redefinir-senha.js <e-mail da conta>');
    return 1;
  }
  try {
    const { usuario, senha } = await redefinirSenha(email);
    console.log(`Senha de ${usuario.nome} (${usuario.email}) redefinida.`);
    console.log(`Senha temporária: ${senha}`);
    console.log('Ela entra com essa senha e troca em Mais → Trocar senha. Os outros aparelhos saíram.');
    return 0;
  } catch (erro) {
    console.error(erro.message);
    return 1;
  } finally {
    await db.destroy();
  }
}

principal().then((codigo) => {
  process.exitCode = codigo;
});
