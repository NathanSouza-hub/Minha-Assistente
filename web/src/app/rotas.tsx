import { createBrowserRouter, type RouteObject } from 'react-router'
import { LayoutApp } from '@/components/layout/LayoutApp'
import { Carregando, RotaProtegida, RotaVisitante } from '@/app/guardas'
import { Mais } from '@/paginas/Mais'
import { NaoEncontrada } from '@/paginas/NaoEncontrada'
import type { TipoEvento } from '@/lib/tipos'

// Telas com formulário (Zod + React Hook Form) e as maiores são baixadas só quando abertas,
// para o app abrir rápido no celular.
const hoje = () => import('@/paginas/Hoje').then((m) => ({ Component: m.Hoje }))
const entrar = () => import('@/paginas/Entrar').then((m) => ({ Component: m.Entrar }))
const cadastro = () => import('@/paginas/Cadastro').then((m) => ({ Component: m.Cadastro }))
const pagamentos = () => import('@/paginas/pagamentos/Pagamentos').then((m) => ({ Component: m.Pagamentos }))
const paginaPagamento = () =>
  import('@/paginas/pagamentos/PaginaPagamento').then((m) => ({ Component: m.PaginaPagamento }))
const paginaCartao = () =>
  import('@/paginas/cartoes/PaginaCartao').then((m) => ({ Component: m.PaginaCartao }))
const paginaCompra = () =>
  import('@/paginas/cartoes/PaginaCompra').then((m) => ({ Component: m.PaginaCompra }))
const agenda = () => import('@/paginas/agenda/Agenda').then((m) => ({ Component: m.Agenda }))
const paginaEvento = () =>
  import('@/paginas/agenda/PaginaEvento').then((m) => ({ Component: m.PaginaEvento }))
// Programa de rádio, Atividade física e Fisioterapia: a agenda só daquele tipo.
const agendaDoTipo = (tipo: TipoEvento, rota: string) => () =>
  import('@/paginas/agenda/AgendaDoTipo').then(({ AgendaDoTipo }) => ({
    Component: () => <AgendaDoTipo tipo={tipo} rota={rota} />,
  }))
const remedios = () => import('@/paginas/remedios/Remedios').then((m) => ({ Component: m.Remedios }))
const paginaRemedio = () =>
  import('@/paginas/remedios/PaginaRemedio').then((m) => ({ Component: m.PaginaRemedio }))
const rotina = () => import('@/paginas/rotina/Rotina').then((m) => ({ Component: m.Rotina }))
const paginaRotina = () =>
  import('@/paginas/rotina/PaginaRotina').then((m) => ({ Component: m.PaginaRotina }))
const viagens = () => import('@/paginas/viagens/Viagens').then((m) => ({ Component: m.Viagens }))
const detalheViagem = () =>
  import('@/paginas/viagens/DetalheViagem').then((m) => ({ Component: m.DetalheViagem }))
const paginaViagem = () =>
  import('@/paginas/viagens/PaginaViagem').then((m) => ({ Component: m.PaginaViagem }))
const compras = () => import('@/paginas/compras/Compras').then((m) => ({ Component: m.Compras }))
const paginaItemCompra = () =>
  import('@/paginas/compras/PaginaItemCompra').then((m) => ({ Component: m.PaginaItemCompra }))
const notificacoes = () => import('@/paginas/Notificacoes').then((m) => ({ Component: m.Notificacoes }))
const imoveis = () => import('@/paginas/Imoveis').then((m) => ({ Component: m.Imoveis }))
const categorias = () =>
  import('@/paginas/categorias/Categorias').then((m) => ({ Component: m.Categorias }))
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
          { index: true, lazy: hoje },
          { path: 'agenda', lazy: agenda },
          { path: 'agenda/novo', lazy: paginaEvento },
          { path: 'agenda/:id', lazy: paginaEvento },
          { path: 'radio', lazy: agendaDoTipo('programa_radio', '/radio') },
          { path: 'atividade-fisica', lazy: agendaDoTipo('atividade_fisica', '/atividade-fisica') },
          { path: 'fisioterapia', lazy: agendaDoTipo('fisioterapia', '/fisioterapia') },
          { path: 'pagamentos', lazy: pagamentos },
          { path: 'pagamentos/novo', lazy: paginaPagamento },
          { path: 'pagamentos/:id', lazy: paginaPagamento },
          { path: 'cartoes/novo', lazy: paginaCartao },
          { path: 'cartoes/:id', lazy: paginaCartao },
          { path: 'cartoes/:id/compras/nova', lazy: paginaCompra },
          { path: 'cartoes/:id/compras/:compraId', lazy: paginaCompra },
          { path: 'remedios', lazy: remedios },
          { path: 'remedios/novo', lazy: paginaRemedio },
          { path: 'remedios/:id', lazy: paginaRemedio },
          { path: 'mais', element: <Mais /> },
          { path: 'rotina', lazy: rotina },
          { path: 'rotina/nova', lazy: paginaRotina },
          { path: 'rotina/:id', lazy: paginaRotina },
          { path: 'viagens', lazy: viagens },
          { path: 'viagens/nova', lazy: paginaViagem },
          { path: 'viagens/:id', lazy: detalheViagem },
          { path: 'viagens/:id/editar', lazy: paginaViagem },
          { path: 'compras', lazy: compras },
          { path: 'compras/:id', lazy: paginaItemCompra },
          { path: 'notificacoes', lazy: notificacoes },
          { path: 'imoveis', lazy: imoveis },
          { path: 'categorias', lazy: categorias },
          { path: 'relatorio', lazy: relatorio },
          { path: '*', element: <NaoEncontrada /> },
        ],
      },
    ],
  },
]

export const rotas = createBrowserRouter(definicaoRotas)
