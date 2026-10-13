import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ProvedorSessao } from '@/app/sessao'
import { definicaoRotas } from '@/app/rotas'

/** Monta o app inteiro (rotas, sessão, consultas) começando em `rota`. */
export function renderizarApp(rota = '/') {
  const roteador = createMemoryRouter(definicaoRotas, { initialEntries: [rota] })
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const resultado = render(
    <QueryClientProvider client={cliente}>
      <ProvedorSessao>
        <RouterProvider router={roteador} />
      </ProvedorSessao>
    </QueryClientProvider>,
  )
  return { ...resultado, roteador }
}
