// Notificações (Web Push) deste aparelho: estado, ativar e desativar. As chamadas ao navegador
// ficam todas aqui; as telas usam os hooks de src/consultas/notificacoes.ts.
import { api } from './api'

export type EstadoPush =
  /** Inscrito: os lembretes chegam neste aparelho. */
  | 'ligado'
  /** Dá para ativar (a permissão ainda não foi pedida, ou foi dada mas falta inscrever). */
  | 'desligado'
  /** A pessoa negou a permissão: só desbloqueando nas configurações do navegador. */
  | 'bloqueado'
  /** iPhone/iPad no Safari: push só no app instalado na Tela de Início (iOS 16.4+). */
  | 'instalar-iphone'
  /** Navegador sem Push API. */
  | 'sem-suporte'
  /** Sem o service worker do app (ex.: em desenvolvimento, ou ainda instalando). */
  | 'indisponivel'

export const ehIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPad com iPadOS se apresenta como Mac.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const instalado = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const temSuporte = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/**
 * O registro do service worker do PWA (sw.js). Em desenvolvimento quem ocupa o escopo é o worker
 * do MSW, que não trata push: nesse caso não há registro do app.
 */
async function registroDoApp() {
  const registros = await navigator.serviceWorker.getRegistrations()
  const doApp = registros.find((r) => (r.active ?? r.waiting ?? r.installing)?.scriptURL.endsWith('/sw.js'))
  if (doApp && !doApp.active) await navigator.serviceWorker.ready
  return doApp ?? null
}

export async function lerEstado(): Promise<EstadoPush> {
  if (ehIOS() && !instalado()) return 'instalar-iphone'
  if (!temSuporte()) return 'sem-suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  const registro = await registroDoApp()
  if (!registro) return 'indisponivel'
  const inscricao = await registro.pushManager.getSubscription()
  return inscricao && Notification.permission === 'granted' ? 'ligado' : 'desligado'
}

/** Chave VAPID (base64url) → bytes, como o pushManager.subscribe espera. */
export function chaveParaBytes(base64url: string) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

const mesmaChave = (atual: ArrayBuffer | null, chave: Uint8Array) =>
  atual !== null && atual.byteLength === chave.byteLength && new Uint8Array(atual).every((b, i) => b === chave[i])

/**
 * Pede a permissão e inscreve o aparelho. Chame direto no clique: o Safari só mostra o pedido de
 * permissão se ele vier de um toque da pessoa (por isso o pedido é a primeira coisa aqui).
 */
export async function ativar(): Promise<EstadoPush> {
  const permissao = await Notification.requestPermission()
  if (permissao === 'denied') return 'bloqueado'
  if (permissao !== 'granted') return 'desligado'

  const registro = await registroDoApp()
  if (!registro) return 'indisponivel'
  const { chavePublica } = await api<{ chavePublica: string }>('/notificacoes/chave-publica')
  const chave = chaveParaBytes(chavePublica)

  let inscricao = await registro.pushManager.getSubscription()
  // Inscrição feita com outra chave (o servidor trocou as chaves VAPID) não recebe mais nada.
  if (inscricao && !mesmaChave(inscricao.options.applicationServerKey, chave)) {
    await inscricao.unsubscribe()
    inscricao = null
  }
  inscricao ??= await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave })
  await api('/notificacoes/inscricoes', { method: 'POST', corpo: inscricao.toJSON() })
  return 'ligado'
}

/**
 * Tira o aparelho da lista do servidor e cancela a inscrição no navegador.
 * @param token para usar ao sair da conta, quando o token já foi apagado do aparelho.
 */
export async function desativar({ token }: { token?: string | null } = {}): Promise<EstadoPush> {
  if (!temSuporte()) return lerEstado()
  const registro = await registroDoApp()
  const inscricao = await registro?.pushManager.getSubscription()
  if (inscricao) {
    await api('/notificacoes/inscricoes', {
      method: 'DELETE',
      corpo: { endpoint: inscricao.endpoint },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    await inscricao.unsubscribe()
  }
  return lerEstado()
}

/** Reenvia a inscrição que o navegador já tem (o servidor pode ter apagado a dele). */
export async function sincronizar() {
  const registro = temSuporte() && Notification.permission === 'granted' ? await registroDoApp() : null
  const inscricao = await registro?.pushManager.getSubscription()
  if (inscricao) await api('/notificacoes/inscricoes', { method: 'POST', corpo: inscricao.toJSON() })
}

// ---- Convite (pedir no momento certo, uma vez por aparelho) ----

const CHAVE_CONVITE = 'minha-assistente:convite-notificacoes'

export function jaConvidou() {
  try {
    return localStorage.getItem(CHAVE_CONVITE) !== null
  } catch {
    return true
  }
}

export function marcarConvidado() {
  try {
    localStorage.setItem(CHAVE_CONVITE, new Date().toISOString())
  } catch {
    // Sem armazenamento (navegação privada): o convite pode aparecer de novo, sem problema.
  }
}
