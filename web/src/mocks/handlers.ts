// API falsa para desenvolver as telas antes do back-end. Os dados vivem só na memória da aba.
// Siga o contrato do back-end à risca: trocar pelo servidor real não pode exigir mudar telas.
import { handlersAuth } from './auth'
import { handlersEventos } from './eventos'
import { handlersHoje } from './hoje'
import { handlersMedicamentos } from './medicamentos'
import { handlersPagamentos } from './pagamentos'
import { handlersRotinas } from './rotinas'
import { handlersViagens } from './viagens'

export { resetarBancoMock } from './banco'

export const handlers = [
  ...handlersAuth,
  ...handlersPagamentos,
  ...handlersEventos,
  ...handlersMedicamentos,
  ...handlersRotinas,
  ...handlersHoje,
  ...handlersViagens,
]
