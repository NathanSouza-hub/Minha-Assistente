import '@testing-library/jest-dom/vitest'

// Roda os testes no fuso do Brasil, onde `new Date("2026-10-13")` mostra o dia anterior.
process.env.TZ = 'America/Sao_Paulo'
