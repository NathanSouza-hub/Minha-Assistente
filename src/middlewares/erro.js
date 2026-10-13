// Tratamento central de erros. Toda resposta de erro segue:
// { "erro": { "codigo": "STRING", "mensagem": "texto" } }
const { ZodError } = require('zod');
const { AppError } = require('../lib/erros');

const responder = (res, status, codigo, mensagem) =>
  res.status(status).json({ erro: { codigo, mensagem } });

function mensagemZod(erro) {
  return erro.issues
    .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join('; ');
}

// Erros do Postgres que significam dado inválido, não falha do servidor.
const ERROS_PG = {
  23505: [409, 'CONFLITO', 'Já existe um registro com esses dados.'],
  23503: [409, 'REFERENCIA_INVALIDA', 'Registro relacionado inexistente ou em uso.'],
  23514: [400, 'VALIDACAO', 'Os dados violam uma regra de consistência.'],
  '22P02': [400, 'VALIDACAO', 'Valor em formato inválido.'],
};

function rotaNaoEncontrada(req, res) {
  responder(res, 404, 'ROTA_NAO_ENCONTRADA', `Rota ${req.method} ${req.path} não existe.`);
}

// eslint-disable-next-line no-unused-vars -- o Express identifica handlers de erro pelos 4 parâmetros
function tratarErro(erro, req, res, next) {
  if (erro instanceof AppError) {
    return responder(res, erro.status, erro.codigo, erro.message);
  }
  if (erro instanceof ZodError) {
    return responder(res, 400, 'VALIDACAO', mensagemZod(erro));
  }
  if (erro.type === 'entity.parse.failed') {
    return responder(res, 400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.');
  }
  if (erro.type === 'entity.too.large') {
    return responder(res, 413, 'CORPO_GRANDE_DEMAIS', 'O corpo da requisição é grande demais.');
  }
  if (ERROS_PG[erro.code]) {
    const [status, codigo, mensagem] = ERROS_PG[erro.code];
    return responder(res, status, codigo, mensagem);
  }

  console.error('[erro não tratado]', erro);
  return responder(res, 500, 'ERRO_INTERNO', 'Erro inesperado no servidor.');
}

module.exports = { tratarErro, rotaNaoEncontrada };
