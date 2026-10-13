import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Roda os testes no fuso do Brasil, onde `new Date("2026-10-13")` mostra o dia anterior.
process.env.TZ = 'America/Sao_Paulo'

// Sem `globals: true` o Testing Library não desmonta sozinho entre os testes.
afterEach(cleanup)
