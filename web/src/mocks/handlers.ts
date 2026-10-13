// API falsa para desenvolver as telas antes do back-end. Os dados vivem só na memória da aba.
// Siga o contrato do back-end à risca: trocar pelo servidor real não pode exigir mudar telas.
import { handlersAuth } from './auth'
import { handlersPagamentos } from './pagamentos'

export { resetarBancoMock } from './banco'

export const handlers = [...handlersAuth, ...handlersPagamentos]
