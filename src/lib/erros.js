// Erro de domínio com status HTTP e código estável para o front.
class AppError extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
  }
}

// naoEncontrado('Viagem', { feminino: true }) → "Viagem não encontrada."
const naoEncontrado = (recurso = 'Recurso', { feminino = false } = {}) =>
  new AppError(404, 'NAO_ENCONTRADO', `${recurso} não ${feminino ? 'encontrada' : 'encontrado'}.`);

const requisicaoInvalida = (mensagem) => new AppError(400, 'VALIDACAO', mensagem);

const naoAutorizado = (mensagem = 'Autenticação necessária.') =>
  new AppError(401, 'NAO_AUTORIZADO', mensagem);

module.exports = { AppError, naoEncontrado, requisicaoInvalida, naoAutorizado };
