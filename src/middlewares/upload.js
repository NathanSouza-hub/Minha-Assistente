// Recebe um único arquivo no campo "arquivo" (multipart/form-data), em memória, até 10 MB.
// O arquivo fica em req.file ({ buffer, originalname, size }).
const multer = require('multer');
const { AppError } = require('../lib/erros');

const TAMANHO_MAXIMO_MB = 10;

const receber = multer({
  storage: multer.memoryStorage(),
  // Navegadores enviam o nome do arquivo em UTF-8 ("passagem-ônibus.pdf").
  defParamCharset: 'utf8',
  limits: { fileSize: TAMANHO_MAXIMO_MB * 1024 * 1024, files: 1, fields: 5 },
}).single('arquivo');

function receberArquivo(req, res, next) {
  receber(req, res, (erro) => {
    if (!erro) return next();
    if (erro instanceof multer.MulterError) {
      if (erro.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError(413, 'ARQUIVO_GRANDE_DEMAIS', `O arquivo pode ter no máximo ${TAMANHO_MAXIMO_MB} MB.`),
        );
      }
      return next(new AppError(400, 'UPLOAD_INVALIDO', 'Envie um único arquivo no campo "arquivo".'));
    }
    return next(erro);
  });
}

module.exports = { receberArquivo, TAMANHO_MAXIMO_MB };
