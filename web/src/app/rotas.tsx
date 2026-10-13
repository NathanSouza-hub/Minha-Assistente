import { createBrowserRouter, type RouteObject } from 'react-router'
import { CalendarDays, ListChecks, Pill, Plane, ShoppingCart } from 'lucide-react'
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
          {
            path: 'agenda',
            element: (
              <EmBreve titulo="Agenda" icone={CalendarDays} descricao="Consultas, exames, reuniões e lembretes." />
            ),
          },
          { path: 'pagamentos', lazy: pagamentos },
          { path: 'pagamentos/novo', lazy: paginaPagamento },
          { path: 'pagamentos/:id', lazy: paginaPagamento },
          {
            path: 'remedios',
            element: (
              <EmBreve titulo="Remédios" icone={Pill} descricao="Horários de cada remédio e o que já foi tomado." />
            ),
          },
          { path: 'mais', element: <Mais /> },
          {
            path: 'rotina',
            element: (
              <EmBreve titulo="Rotina" icone={ListChecks} descricao="Tarefas que se repetem e o check de cada dia." />
            ),
          },
          {
            path: 'viagens',
            element: (
              <EmBreve titulo="Viagens" icone={Plane} descricao="Datas, hospedagem, transporte e passagens." />
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
