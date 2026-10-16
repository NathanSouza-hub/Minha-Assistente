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

/**
 * Troca a senha e encerra as sessões dos outros aparelhos (`sessoesDesde`, conferido em
 * `autenticar`). Devolve uma sessão nova para quem trocou continuar conectado.
 */
async function trocarSenha(usuarioId, { senhaAtual, novaSenha }) {
  const usuario = await db('usuario').where({ id: usuarioId }).first();
  if (!(await bcrypt.compare(senhaAtual, usuario.senhaHash))) {
    throw new AppError(400, 'SENHA_INCORRETA', 'A senha atual não confere.');
  }
  const senhaHash = await bcrypt.hash(novaSenha, CUSTO_BCRYPT);
  await db.transaction(async (trx) => {
    // Truncado ao segundo: o `iat` do JWT é em segundos, e o token novo (emitido logo depois)
    // não pode cair antes desse instante.
    await trx('usuario')
      .where({ id: usuarioId })
      .update({ senhaHash, sessoesDesde: trx.raw("date_trunc('second', now())") });
    // Um aparelho perdido também para de receber lembretes. O que trocou a senha reenvia a
    // inscrição sozinho quando recebe o token novo (acompanharInscricao, no front).
    await trx('pushInscricao').where({ usuarioId }).del();
  });
  return sessao(publico(usuario));
}

/** Para `autenticar`: o usuário público e desde quando as sessões valem. */
async function buscarParaSessao(id) {
  const linha = await db('usuario').select([...CAMPOS_PUBLICOS, 'sessoesDesde']).where({ id }).first();
  if (!linha) return null;
  const { sessoesDesde, ...usuario } = linha;
  return { usuario, sessoesDesde };
}

module.exports = { cadastrar, entrar, trocarSenha, buscarParaSessao };
