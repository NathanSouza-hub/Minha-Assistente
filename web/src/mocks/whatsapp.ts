// WhatsApp — regras espelhando src/modules/whatsapp do back-end (decisão 38). Não há webhook no
// mock: para simular a pessoa mandando o código, use `vincularNoMock` (como o webhook faria).
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { agoraISO, banco } from './banco'
import { autenticado } from './util'

export const NUMERO_DO_APP_MOCK = '5511999990000'
const VALIDADE_MS = 10 * 60_000

const vinculoDe = (usuarioId: string) =>
  banco.whatsapp.get(usuarioId) ?? { telefone: null, vinculadoEm: null, codigo: null, expiraEm: null }

/** O que o webhook faz quando chega o código certo: liga o número à conta dona do código. */
export function vincularNoMock(codigo: string, telefone: string) {
  const dono = [...banco.whatsapp.entries()].find(([, v]) => v.codigo === codigo && (v.expiraEm ?? 0) > Date.now())
  if (!dono) return false
  for (const v of banco.whatsapp.values()) if (v.telefone === telefone) Object.assign(v, { telefone: null, vinculadoEm: null })
  banco.whatsapp.set(dono[0], { telefone, vinculadoEm: agoraISO(), codigo: null, expiraEm: null })
  return true
}

export const handlersWhatsapp = [
  http.get(
    `${API_URL}/whatsapp`,
    autenticado((_, usuario) => {
      const v = vinculoDe(usuario.id)
      return HttpResponse.json({
        disponivel: true,
        numero: NUMERO_DO_APP_MOCK,
        vinculado: Boolean(v.telefone),
        telefone: v.telefone ? `•••• ${v.telefone.slice(-4)}` : null,
        vinculadoEm: v.telefone ? v.vinculadoEm : null,
      })
    }),
  ),

  http.post(
    `${API_URL}/whatsapp/codigo`,
    autenticado((_, usuario) => {
      const codigo = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
      const expiraEm = Date.now() + VALIDADE_MS
      banco.whatsapp.set(usuario.id, { ...vinculoDe(usuario.id), codigo, expiraEm })
      return HttpResponse.json(
        {
          codigo,
          expiraEm: new Date(expiraEm).toISOString().replace(/\.\d{3}Z$/, 'Z'),
          numero: NUMERO_DO_APP_MOCK,
          link: `https://wa.me/${NUMERO_DO_APP_MOCK}?text=${codigo}`,
        },
        { status: 201 },
      )
    }),
  ),

  http.post(
    `${API_URL}/notificacoes/whatsapp/teste`,
    autenticado((_, usuario) => {
      if (vinculoDe(usuario.id).telefone) return new HttpResponse(null, { status: 204 })
      return HttpResponse.json(
        { erro: { codigo: 'SEM_WHATSAPP', mensagem: 'Ligue o seu WhatsApp à conta primeiro.' } },
        { status: 409 },
      )
    }),
  ),

  http.delete(
    `${API_URL}/whatsapp`,
    autenticado((_, usuario) => {
      banco.whatsapp.set(usuario.id, { telefone: null, vinculadoEm: null, codigo: null, expiraEm: null })
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
