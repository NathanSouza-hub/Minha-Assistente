// API falsa para desenvolver as telas antes do back-end. Os dados vivem só na memória da aba.
// Siga o contrato do back-end à risca: trocar pelo servidor real não pode exigir mudar telas.
import { handlersAuth } from './auth'
import { handlersCartoes } from './cartoes'
import { handlersEquipe } from './equipe'
import { handlersCompras } from './compras'
import { handlersEventos } from './eventos'
import { handlersHoje } from './hoje'
import { handlersMedicamentos } from './medicamentos'
import { handlersNotificacoes } from './notificacoes'
import { handlersPagamentos } from './pagamentos'
import { handlersRecebiveis } from './recebiveis'
import { handlersRotinas } from './rotinas'
import { handlersTarefas } from './tarefas'
import { handlersViagens } from './viagens'

export { resetarBancoMock } from './banco'

export const handlers = [
  ...handlersAuth,
  ...handlersPagamentos,
  ...handlersRecebiveis,
  ...handlersCartoes,
  ...handlersEquipe,
  ...handlersEventos,
  ...handlersMedicamentos,
  ...handlersRotinas,
  ...handlersTarefas,
  ...handlersHoje,
  ...handlersViagens,
  ...handlersCompras,
  ...handlersNotificacoes,
]
