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

import { banco, resetarBancoMock as recriarBanco } from './banco'
import { garantirContasEquipe } from './equipe'

/** Como src/jobs/manutencao.js: cria as contas da equipe de quem tem alguém ativo. */
function manutencao() {
  for (const usuarioId of new Set(banco.membros.filter((m) => m.ativo).map((m) => m.usuarioId))) {
    garantirContasEquipe(usuarioId)
  }
}

/** Dados de exemplo do zero, com a manutenção já rodada (como o servidor ao subir). */
export function resetarBancoMock() {
  recriarBanco()
  manutencao()
}

manutencao()

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
