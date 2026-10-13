// Token JWT da sessão, guardado no aparelho. O back-end assina com `exp` (padrão 30 dias).

const CHAVE = 'minha-assistente:token'

export function lerToken(): string | null {
  try {
    return localStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

export function salvarToken(token: string) {
  try {
    localStorage.setItem(CHAVE, token)
  } catch {
    // Modo privado ou armazenamento bloqueado: a sessão dura só enquanto a aba estiver aberta.
  }
}

export function apagarToken() {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // idem
  }
}

/** Lê `exp` (segundos) do payload, sem validar a assinatura — isso é papel do back-end. */
export function expiracaoDoToken(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const { exp } = JSON.parse(json) as { exp?: unknown }
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

/** Token ausente, malformado ou vencido conta como expirado. */
export function tokenExpirado(token: string | null, agoraMs = Date.now()): boolean {
  if (!token) return true
  const exp = expiracaoDoToken(token)
  return exp === null || exp <= agoraMs
}
