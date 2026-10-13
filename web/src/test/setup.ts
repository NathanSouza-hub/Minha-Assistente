import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { toast } from 'sonner'

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
window.scrollTo = () => {}
