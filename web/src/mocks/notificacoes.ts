// Notificações — regras espelhando src/modules/notificacoes do back-end (etapa 11). O mock só
// guarda as inscrições: nenhum push é enviado de verdade.
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { banco } from './banco'
import { autenticado, erro } from './util'

/** Chave pública VAPID de exemplo (um ponto P-256 válido, 65 bytes). */
export const CHAVE_PUBLICA_MOCK =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'

const bytes = (base64url: string) => {
  try {
    return atob(base64url.replace(/-/g, '+').replace(/_/g, '/')).length
  } catch {
    return -1
  }
}

type Corpo = { endpoint?: string; keys?: { p256dh?: string; auth?: string } }

function validar({ endpoint, keys }: Corpo, comChaves: boolean) {
  const problemas: string[] = []
  if (!endpoint?.startsWith('https://')) problemas.push('endpoint: Endereço de inscrição inválido.')
  if (comChaves) {
    if (bytes(keys?.p256dh ?? '') !== 65) problemas.push('keys.p256dh: A chave precisa ter 65 bytes.')
    if (bytes(keys?.auth ?? '') !== 16) problemas.push('keys.auth: A chave precisa ter 16 bytes.')
  }
  return problemas.length ? erro(400, 'VALIDACAO', problemas.join('; ')) : null
}

export const handlersNotificacoes = [
  http.get(
    `${API_URL}/notificacoes/chave-publica`,
    autenticado(() => HttpResponse.json({ chavePublica: CHAVE_PUBLICA_MOCK })),
  ),

  http.post(
    `${API_URL}/notificacoes/inscricoes`,
    autenticado(async ({ request }, u) => {
      const corpo = (await request.json()) as Corpo
      const invalido = validar(corpo, true)
      if (invalido) return invalido
      // O endpoint é único por navegador: se outra pessoa entrou no aparelho, passa para ela.
      let inscricao = banco.inscricoesPush.find((i) => i.endpoint === corpo.endpoint)
      if (!inscricao) {
        inscricao = { id: crypto.randomUUID(), usuarioId: u.id, endpoint: corpo.endpoint!, p256dh: '', auth: '' }
        banco.inscricoesPush.push(inscricao)
      }
      Object.assign(inscricao, { usuarioId: u.id, p256dh: corpo.keys!.p256dh!, auth: corpo.keys!.auth! })
      return HttpResponse.json({ id: inscricao.id, endpoint: inscricao.endpoint }, { status: 201 })
    }),
  ),

  http.delete(
    `${API_URL}/notificacoes/inscricoes`,
    autenticado(async ({ request }, u) => {
      const corpo = (await request.json().catch(() => ({}))) as Corpo
      const invalido = validar(corpo, false)
      if (invalido) return invalido
      banco.inscricoesPush = banco.inscricoesPush.filter((i) => !(i.endpoint === corpo.endpoint && i.usuarioId === u.id))
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.post(
    `${API_URL}/notificacoes/teste`,
    autenticado((_ctx, u) =>
      banco.inscricoesPush.some((i) => i.usuarioId === u.id)
        ? new HttpResponse(null, { status: 204 })
        : erro(409, 'SEM_INSCRICAO', 'Nenhum aparelho inscrito.'),
    ),
  ),
]
