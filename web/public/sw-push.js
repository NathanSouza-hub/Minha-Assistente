// Importado pelo service worker gerado pelo Workbox (vite.config.ts → workbox.importScripts).
// Carga enviada pelo back-end (src/lembretes/agendador.js): { titulo, corpo, url, tag }.

self.addEventListener('push', (evento) => {
  let dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : '' }
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || 'Minha Assistente', {
      body: dados.corpo || '',
      // A mesma tag substitui o aviso anterior do mesmo lembrete em vez de empilhar.
      tag: dados.tag,
      renotify: Boolean(dados.tag),
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: 'pt-BR',
      data: { url: dados.url || '/' },
    }),
  )
})

// Tocar na notificação abre o app na tela do lembrete (ou traz para frente a janela já aberta).
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = new URL(evento.notification.data?.url || '/', self.location.origin).href
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (janelas) => {
      const janela = janelas.find((j) => new URL(j.url).origin === self.location.origin)
      if (!janela) return self.clients.openWindow(url)
      await janela.focus()
      return janela.navigate(url).catch(() => undefined)
    }),
  )
})

// O navegador renovou (ou cancelou) a inscrição. O worker não tem o token da sessão para avisar o
// servidor: ele se reinscreve com a mesma chave e pede às janelas abertas que reenviem
// (src/lib/notificacoes.ts → acompanharInscricao). Sem janela aberta, o app reenvia ao abrir.
self.addEventListener('pushsubscriptionchange', (evento) => {
  evento.waitUntil(
    (async () => {
      const chave = evento.oldSubscription?.options?.applicationServerKey
      if (chave && !evento.newSubscription) {
        await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave })
      }
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const janela of janelas) janela.postMessage({ tipo: 'inscricao-push-mudou' })
    })(),
  )
})
