// Arquivos enviados (anexos de viagem, comprovantes de conta): limites e utilidades comuns.

/** Mesmo limite do back-end (src/middlewares/upload.js). */
export const TAMANHO_MAXIMO_MB = 10
/** Tipos que o back-end aceita (detectados pelo conteúdo); `.heic` porque nem todo celular informa o tipo. */
export const TIPOS_ACEITOS = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic'

/** 2048 → "2 KB"; 1572864 → "1,5 MB". */
export function formatarTamanho(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

/** Entrega o arquivo baixado ao navegador com o nome original (um <a href> comum não mandaria o token). */
export function salvarNoAparelho(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.append(link)
  link.click()
  link.remove()
  // Revogar logo cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
