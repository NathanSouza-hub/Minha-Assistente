const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const token = require('../../lib/token');
const { AppError } = require('../../lib/erros');
const { criarPadrao } = require('../categorias/padrao');

const CUSTO_BCRYPT = 12;

// Comparado quando o e-mail não existe, para o login levar o mesmo tempo nos dois casos
// e não revelar quais e-mails têm conta.
const HASH_FICTICIO = '$2b$12$J2vhzZrJqkxd6xxb8MRRluhQ4Wdtgszfz21FTQpB14zOGI1IYCCFK';

const CAMPOS_PUBLICOS = ['id', 'nome', 'email', 'criadoEm'];

const sessao = (usuario) => ({ token: token.assinar(usuario.id), usuario });

const publico = ({ id, nome, email, criadoEm }) => ({ id, nome, email, criadoEm });

async function cadastrar({ nome, email, senha }) {
  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  try {
    const usuario = await db.transaction(async (trx) => {
      const [criado] = await trx('usuario').insert({ nome, email, senhaHash }).returning(CAMPOS_PUBLICOS);
      await criarPadrao(trx, criado.id);
      return criado;
    });
    return sessao(usuario);
  } catch (erro) {
    if (erro.code === '23505') {
      throw new AppError(409, 'EMAIL_EM_USO', 'Já existe uma conta com este e-mail.');
    }
    throw erro;
  }
}

async function entrar({ email, senha }) {
  const usuario = await db('usuario').where({ email }).first();
  const senhaConfere = await bcrypt.compare(senha, usuario ? usuario.senhaHash : HASH_FICTICIO);
  if (!usuario || !senhaConfere) {
    throw new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
  }
  return sessao(publico(usuario));
}

const buscarPorId = (id) => db('usuario').select(CAMPOS_PUBLICOS).where({ id }).first();

module.exports = { cadastrar, entrar, buscarPorId };
