import { createBrowserRouter, type RouteObject } from 'react-router'
import { Plane, ShoppingCart } from 'lucide-react'
import { LayoutApp } from '@/components/layout/LayoutApp'
import { Carregando, RotaProtegida, RotaVisitante } from '@/app/guardas'
import { EmBreve } from '@/paginas/EmBreve'
import { Hoje } from '@/paginas/Hoje'
import { Mais } from '@/paginas/Mais'
import { NaoEncontrada } from '@/paginas/NaoEncontrada'

// Telas com formulário (Zod + React Hook Form) e as maiores são baixadas só quando abertas,
// para o app abrir rápido no celular.
const entrar = () => import('@/paginas/Entrar').then((m) => ({ Component: m.Entrar }))
const cadastro = () => import('@/paginas/Cadastro').then((m) => ({ Component: m.Cadastro }))
const pagamentos = () => import('@/paginas/pagamentos/Pagamentos').then((m) => ({ Component: m.Pagamentos }))
const paginaPagamento = () =>
  import('@/paginas/pagamentos/PaginaPagamento').then((m) => ({ Component: m.PaginaPagamento }))
const agenda = () => import('@/paginas/agenda/Agenda').then((m) => ({ Component: m.Agenda }))
const paginaEvento = () =>
  import('@/paginas/agenda/PaginaEvento').then((m) => ({ Component: m.PaginaEvento }))
const remedios = () => import('@/paginas/remedios/Remedios').then((m) => ({ Component: m.Remedios }))
const paginaRemedio = () =>
  import('@/paginas/remedios/PaginaRemedio').then((m) => ({ Component: m.PaginaRemedio }))
const rotina = () => import('@/paginas/rotina/Rotina').then((m) => ({ Component: m.Rotina }))
const paginaRotina = () =>
  import('@/paginas/rotina/PaginaRotina').then((m) => ({ Component: m.PaginaRotina }))
const imoveis = () => import('@/paginas/Imoveis').then((m) => ({ Component: m.Imoveis }))
const relatorio = () => import('@/paginas/Relatorio').then((m) => ({ Component: m.Relatorio }))

// Exportado separado para os testes montarem com createMemoryRouter.
export const definicaoRotas: RouteObject[] = [
  {
    element: <RotaVisitante />,
    hydrateFallbackElement: <Carregando />,
    children: [
      { path: 'entrar', lazy: entrar },
      { path: 'cadastro', lazy: cadastro },
    ],
  },
  {
    element: <RotaProtegida />,
    // Mostrado se a primeira tela aberta for uma das carregadas sob demanda.
    hydrateFallbackElement: <Carregando />,
    children: [
      {
        element: <LayoutApp />,
        children: [
          { index: true, element: <Hoje /> },
          { path: 'agenda', lazy: agenda },
          { path: 'agenda/novo', lazy: paginaEvento },
          { path: 'agenda/:id', lazy: paginaEvento },
          { path: 'pagamentos', lazy: pagamentos },
          { path: 'pagamentos/novo', lazy: paginaPagamento },
          { path: 'pagamentos/:id', lazy: paginaPagamento },
          { path: 'remedios', lazy: remedios },
          { path: 'remedios/novo', lazy: paginaRemedio },
          { path: 'remedios/:id', lazy: paginaRemedio },
          { path: 'mais', element: <Mais /> },
          { path: 'rotina', lazy: rotina },
          { path: 'rotina/nova', lazy: paginaRotina },
          { path: 'rotina/:id', lazy: paginaRotina },
          {
            path: 'viagens',
            element: (
              <EmBreve
                titulo="Viagens"
                icone={Plane}
                descricao="Datas, hospedagem, transporte e passagens."
              />
            ),
          },
          {
            path: 'compras',
            element: (
              <EmBreve
                titulo="Compras"
                icone={ShoppingCart}
                descricao="A lista do mercado e de tudo o que falta comprar."
              />
            ),
          },
          { path: 'imoveis', lazy: imoveis },
          { path: 'relatorio', lazy: relatorio },
          { path: '*', element: <NaoEncontrada /> },
        ],
      },
    ],
  },
]

export const rotas = createBrowserRouter(definicaoRotas)
