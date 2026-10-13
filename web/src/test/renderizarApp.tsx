import { render } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { criarClienteConsultas } from '@/app/consultas'
import { ProvedorSessao } from '@/app/sessao'
import { definicaoRotas } from '@/app/rotas'
import { api } from '@/lib/api'
import { salvarToken } from '@/lib/sessao'
import type { Sessao } from '@/lib/tipos'

/** Monta o app inteiro (rotas, sessão, consultas, avisos) começando em `rota`. */
export function renderizarApp(rota = '/') {
  const roteador = createMemoryRouter(definicaoRotas, { initialEntries: [rota] })
  const cliente = criarClienteConsultas({ repetir: false })
  const resultado = render(
    <QueryClientProvider client={cliente}>
      <ProvedorSessao>
        <RouterProvider router={roteador} />
        <Toaster />
      </ProvedorSessao>
    </QueryClientProvider>,
  )
  return { ...resultado, roteador }
}

/** Deixa a sessão da Maria (usuária de exemplo do mock) salva antes de montar o app. */
export async function entrarComoMaria() {
  const { token } = await api<Sessao>('/auth/login', {
    method: 'POST',
    corpo: { email: 'maria@exemplo.com', senha: 'uma-senha-forte' },
  })
  salvarToken(token)
}
