// Exige "Authorization: Bearer <token>" e coloca o usuário em req.usuario.
// Todo service filtra pelos dados de req.usuario.id.
const token = require('../lib/token');
const { naoAutorizado } = require('../lib/erros');
const authService = require('../modules/auth/service');

async function autenticar(req, res, next) {
  const [tipo, valor] = (req.get('authorization') ?? '').split(' ');
  if (tipo !== 'Bearer' || !valor) {
    throw naoAutorizado('Envie o token no cabeçalho Authorization: Bearer <token>.');
  }

  let payload;
  try {
    payload = token.verificar(valor);
  } catch (erro) {
    throw naoAutorizado(
      erro.name === 'TokenExpiredError' ? 'Sessão expirada. Entre novamente.' : 'Token inválido.',
    );
  }

  const usuario = await authService.buscarPorId(payload.sub);
  if (!usuario) throw naoAutorizado('Conta não encontrada. Entre novamente.');

  req.usuario = usuario;
  next();
}

module.exports = { autenticar };
