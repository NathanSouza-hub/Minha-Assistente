const crypto = require('node:crypto');
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

const sessao = (usuario, versaoSessao = 0) => ({ token: token.assinar(usuario.id, versaoSessao), usuario });

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
  // A versão vem da mesma linha do hash conferido: um login que corre junto com uma troca de
  // senha sai com a versão antiga e cai logo em seguida.
  return sessao(publico(usuario), usuario.versaoSessao);
}

/**
 * Grava a senha nova e encerra todas as sessões (incrementa `versaoSessao`, conferida em
 * `autenticar`). Só grava se o hash ainda é `hashAnterior`: de duas trocas ao mesmo tempo, vale a
 * primeira. Devolve a versão nova.
 */
async function gravarSenha(usuarioId, hashAnterior, novaSenha) {
  const senhaHash = await bcrypt.hash(novaSenha, CUSTO_BCRYPT);
  return db.transaction(async (trx) => {
    const [atualizado] = await trx('usuario')
      .where({ id: usuarioId, senhaHash: hashAnterior })
      .update({ senhaHash, versaoSessao: trx.raw('versao_sessao + 1') })
      .returning(['versaoSessao']);
    if (!atualizado) {
      throw new AppError(409, 'CONFLITO', 'A senha acabou de ser trocada em outro aparelho. Entre novamente.');
    }
    // Um aparelho perdido também para de receber lembretes. Quem continua conectado reenvia a
    // inscrição sozinho quando recebe o token novo (acompanharInscricao, no front).
    await trx('pushInscricao').where({ usuarioId }).del();
    return atualizado.versaoSessao;
  });
}

/** Troca a senha e devolve uma sessão nova para quem trocou continuar conectado. */
async function trocarSenha(usuarioId, { senhaAtual, novaSenha }) {
  const usuario = await db('usuario').where({ id: usuarioId }).first();
  if (!(await bcrypt.compare(senhaAtual, usuario.senhaHash))) {
    throw new AppError(400, 'SENHA_INCORRETA', 'A senha atual não confere.');
  }
  const versaoSessao = await gravarSenha(usuarioId, usuario.senhaHash, novaSenha);
  return sessao(publico(usuario), versaoSessao);
}

// Sem letras e números que se confundem (0/O, 1/l/I), para ditar por telefone.
const ALFABETO_TEMPORARIA = 'abcdefghjkmnpqrstuvwxyz23456789';

/** "xxxx-xxxx-xxxx": 12 caracteres sorteados (~59 bits), fácil de ler e digitar. */
function senhaTemporaria() {
  const letras = Array.from({ length: 12 }, () => ALFABETO_TEMPORARIA[crypto.randomInt(ALFABETO_TEMPORARIA.length)]).join('');
  return letras.match(/.{4}/g).join('-');
}

/**
 * Para quem esqueceu a senha (enquanto não há redefinição por e-mail): gera uma senha temporária,
 * encerra todas as sessões e devolve a senha para o administrador passar à pessoa, que a troca em
 * Mais → Trocar senha. Usado por `src/cli/redefinir-senha.js`.
 */
async function redefinirSenha(email) {
  const usuario = await db('usuario').where({ email }).first();
  if (!usuario) throw new AppError(404, 'NAO_ENCONTRADO', `Nenhuma conta com o e-mail ${email}.`);
  const senha = senhaTemporaria();
  await gravarSenha(usuario.id, usuario.senhaHash, senha);
  return { usuario: publico(usuario), senha };
}

/** Para `autenticar`: o usuário público e a versão de sessão que vale hoje. */
async function buscarParaSessao(id) {
  const linha = await db('usuario').select([...CAMPOS_PUBLICOS, 'versaoSessao']).where({ id }).first();
  if (!linha) return null;
  const { versaoSessao, ...usuario } = linha;
  return { usuario, versaoSessao };
}

module.exports = { cadastrar, entrar, trocarSenha, redefinirSenha, buscarParaSessao };
