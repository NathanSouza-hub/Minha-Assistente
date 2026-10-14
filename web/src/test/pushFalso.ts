// Navegador falso para os testes de notificação: o jsdom não tem Notification, PushManager nem
// service worker. Simula o que src/lib/notificacoes.ts usa e guarda a inscrição em memória.
import { vi } from 'vitest'
import { CHAVE_PUBLICA_MOCK } from '@/mocks/notificacoes'

export const ENDPOINT_FALSO = 'https://push.exemplo.com/aparelho-1'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

type Opcoes = {
  /** Permissão atual do site. */
  permissao?: NotificationPermission
  /** O que a pessoa responde ao pedido de permissão. */
  resposta?: NotificationPermission
  /** Safari do iPhone, fora do app instalado (sem Push API). */
  iphone?: boolean
  /** Já inscrito neste aparelho. */
  inscrito?: boolean
}

export function instalarPushFalso({ permissao = 'default', resposta = 'granted', iphone = false, inscrito = false }: Opcoes = {}) {
  const estado = { permissao, inscricao: null as ReturnType<typeof criarInscricao> | null }

  function criarInscricao(chave: Uint8Array) {
    const inscricao = {
      endpoint: ENDPOINT_FALSO,
      options: { applicationServerKey: chave.slice().buffer },
      toJSON: () => ({
        endpoint: ENDPOINT_FALSO,
        expirationTime: null,
        // Chaves com o tamanho de verdade (o back-end confere): 65 e 16 bytes.
        keys: { p256dh: CHAVE_PUBLICA_MOCK, auth: 'tBHItJI5svbpez7KI4CCXg' },
      }),
      unsubscribe: vi.fn(async () => {
        estado.inscricao = null
        return true
      }),
    }
    return inscricao
  }

  const requestPermission = vi.fn(async () => {
    estado.permissao = resposta
    return resposta
  })
  const subscribe = vi.fn(async ({ applicationServerKey }: { applicationServerKey: Uint8Array; userVisibleOnly: boolean }) => {
    estado.inscricao = criarInscricao(applicationServerKey)
    return estado.inscricao
  })

  if (iphone) {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: IPHONE_SAFARI })
  } else {
    vi.stubGlobal(
      'Notification',
      class {
        static get permission() {
          return estado.permissao
        }
        static requestPermission = requestPermission
      },
    )
    vi.stubGlobal('PushManager', class {})
    const registro = {
      active: { scriptURL: `${location.origin}/sw.js` },
      pushManager: { getSubscription: async () => estado.inscricao, subscribe },
    }
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistrations: async () => [registro], ready: Promise.resolve(registro) },
    })
  }

  if (inscrito) {
    estado.permissao = 'granted'
    estado.inscricao = criarInscricao(new Uint8Array(65))
  }
  return { estado, requestPermission, subscribe }
}

export function removerPushFalso() {
  vi.unstubAllGlobals()
  const nav = navigator as unknown as Record<string, unknown>
  delete nav.serviceWorker
  delete nav.userAgent
}
