import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'
import { toast } from 'sonner'

// Telas carregadas sob demanda (lazy) podem passar de 1 s com a suíte inteira rodando em paralelo;
// com a barra lateral e o menu da área a mais em cada tela, 3 s às vezes não bastava no CI.
configure({ asyncUtilTimeout: 5000 })

// Roda os testes no fuso do Brasil, onde `new Date("2026-10-13")` mostra o dia anterior.
process.env.TZ = 'America/Sao_Paulo'

// Sem `globals: true` o Testing Library não desmonta sozinho entre os testes.
afterEach(() => {
  cleanup()
  // Os avisos do sonner ficam num estado global: sem isso vazam para o teste seguinte.
  toast.dismiss()
})

// APIs do navegador que o jsdom não tem e que os componentes do Radix usam.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollIntoView ??= () => {}
// O sonner usa para arrastar o aviso.
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
window.scrollTo = () => {}

// O fetch do Node não sabe enviar o FormData do jsdom ("fetch failed"); nos testes o upload usa o
// FormData do próprio Node. Os arquivos dos testes são `File` de 'node:buffer' pelo mesmo motivo.
globalThis.FormData = (await new Response(new URLSearchParams()).formData()).constructor as typeof FormData
