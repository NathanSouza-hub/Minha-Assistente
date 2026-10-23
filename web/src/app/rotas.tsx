import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Redirecionar } from '@/components/Redirecionar'
import { LayoutApp } from '@/components/layout/LayoutApp'
import { Carregando, RotaProtegida, RotaVisitante } from '@/app/guardas'
import { Configuracoes } from '@/paginas/Configuracoes'
import { NaoEncontrada } from '@/paginas/NaoEncontrada'
import type { TipoEvento } from '@/lib/tipos'

// Telas com formulário (Zod + React Hook Form) e as maiores são baixadas só quando abertas,
// para o app abrir rápido no celular.
const financas = () =>
  import('@/paginas/inicio/PainelFinanceiro').then((m) => ({ Component: m.PainelFinanceiro }))
const hoje = () => import('@/paginas/Hoje').then((m) => ({ Component: m.Hoje }))
const entrar = () => import('@/paginas/Entrar').then((m) => ({ Component: m.Entrar }))
const cadastro = () => import('@/paginas/Cadastro').then((m) => ({ Component: m.Cadastro }))
const pagamentos = () => import('@/paginas/pagamentos/Pagamentos').then((m) => ({ Component: m.Pagamentos }))
const despesas = () => import('@/paginas/pagamentos/ListaDespesas').then((m) => ({ Component: m.ListaDespesas }))
const paginaPagamento = () =>
  import('@/paginas/pagamentos/PaginaPagamento').then((m) => ({ Component: m.PaginaPagamento }))
const paginaMembro = () =>
  import('@/paginas/equipe/PaginaMembro').then((m) => ({ Component: m.PaginaMembro }))
const paginaCartao = () =>
  import('@/paginas/cartoes/PaginaCartao').then((m) => ({ Component: m.PaginaCartao }))
const paginaCompra = () =>
  import('@/paginas/cartoes/PaginaCompra').then((m) => ({ Component: m.PaginaCompra }))
const agenda = () => import('@/paginas/agenda/Agenda').then((m) => ({ Component: m.Agenda }))
const paginaEvento = () =>
  import('@/paginas/agenda/PaginaEvento').then((m) => ({ Component: m.PaginaEvento }))
// Programa de rádio, Atividade física e Fisioterapia: a agenda só daquele tipo.
const agendaDoTipo = (tipo: TipoEvento, rota: string, titulo?: string) => () =>
  import('@/paginas/agenda/AgendaDoTipo').then(({ AgendaDoTipo }) => ({
    Component: () => <AgendaDoTipo tipo={tipo} rota={rota} titulo={titulo} />,
  }))
const remedios = () => import('@/paginas/remedios/Remedios').then((m) => ({ Component: m.Remedios }))
const paginaRemedio = () =>
  import('@/paginas/remedios/PaginaRemedio').then((m) => ({ Component: m.PaginaRemedio }))
const rotina = () => import('@/paginas/rotina/Rotina').then((m) => ({ Component: m.Rotina }))
const paginaRotina = () =>
  import('@/paginas/rotina/PaginaRotina').then((m) => ({ Component: m.PaginaRotina }))
const tarefas = () => import('@/paginas/tarefas/Tarefas').then((m) => ({ Component: m.Tarefas }))
const paginaTarefa = () => import('@/paginas/tarefas/PaginaTarefa').then((m) => ({ Component: m.PaginaTarefa }))
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
const detalheImovel = () =>
  import('@/paginas/imoveis/DetalheImovel').then((m) => ({ Component: m.DetalheImovel }))
const categorias = () =>
  import('@/paginas/categorias/Categorias').then((m) => ({ Component: m.Categorias }))
const recebiveis = () => import('@/paginas/recebiveis/Recebiveis').then((m) => ({ Component: m.Recebiveis }))
const paginaRecebivel = () =>
  import('@/paginas/recebiveis/PaginaRecebivel').then((m) => ({ Component: m.PaginaRecebivel }))
const trocarSenha = () => import('@/paginas/TrocarSenha').then((m) => ({ Component: m.TrocarSenha }))

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
          // Início = as atividades do dia. /hoje e /mais ficam como atalhos antigos (links e avisos já enviados).
          { index: true, lazy: hoje },
          { path: 'hoje', element: <Redirecionar para="/" /> },
          { path: 'financas', lazy: financas },
          { path: 'agenda', lazy: agenda },
          { path: 'agenda/novo', lazy: paginaEvento },
          { path: 'agenda/:id', lazy: paginaEvento },
          { path: 'radio', lazy: agendaDoTipo('programa_radio', '/radio') },
          { path: 'atividade-fisica', lazy: agendaDoTipo('atividade_fisica', '/atividade-fisica') },
          { path: 'fisioterapia', lazy: agendaDoTipo('fisioterapia', '/fisioterapia') },
          { path: 'consultas', lazy: agendaDoTipo('consulta', '/consultas', 'Consultas') },
          { path: 'exames', lazy: agendaDoTipo('exame', '/exames', 'Exames') },
          { path: 'despesas', lazy: despesas },
          { path: 'pagamentos', lazy: pagamentos },
          { path: 'pagamentos/novo', lazy: paginaPagamento },
          { path: 'pagamentos/:id', lazy: paginaPagamento },
          { path: 'recebiveis', lazy: recebiveis },
          { path: 'recebiveis/novo', lazy: paginaRecebivel },
          { path: 'recebiveis/:id', lazy: paginaRecebivel },
          { path: 'equipe/novo', lazy: paginaMembro },
          { path: 'equipe/:id', lazy: paginaMembro },
          { path: 'cartoes/novo', lazy: paginaCartao },
          { path: 'cartoes/:id', lazy: paginaCartao },
          { path: 'cartoes/:id/compras/nova', lazy: paginaCompra },
          { path: 'cartoes/:id/compras/:compraId', lazy: paginaCompra },
          { path: 'remedios', lazy: remedios },
          { path: 'remedios/novo', lazy: paginaRemedio },
          { path: 'remedios/:id', lazy: paginaRemedio },
          { path: 'configuracoes', element: <Configuracoes /> },
          { path: 'mais', element: <Redirecionar para="/configuracoes" /> },
          { path: 'rotina', lazy: rotina },
          { path: 'rotina/nova', lazy: paginaRotina },
          { path: 'rotina/:id', lazy: paginaRotina },
          { path: 'tarefas', lazy: tarefas },
          { path: 'tarefas/nova', lazy: paginaTarefa },
          { path: 'tarefas/:id', lazy: paginaTarefa },
          { path: 'viagens', lazy: viagens },
          { path: 'viagens/nova', lazy: paginaViagem },
          { path: 'viagens/:id', lazy: detalheViagem },
          { path: 'viagens/:id/editar', lazy: paginaViagem },
          { path: 'compras', lazy: compras },
          { path: 'compras/:id', lazy: paginaItemCompra },
          { path: 'notificacoes', lazy: notificacoes },
          { path: 'imoveis', lazy: imoveis },
          { path: 'imoveis/:id', lazy: detalheImovel },
          { path: 'categorias', lazy: categorias },
          // O relatório virou a aba "Relatório" da Visão geral de Finanças; o endereço antigo leva para lá.
          { path: 'relatorio', element: <Navigate to="/financas?vista=relatorio" replace /> },
          { path: 'conta/senha', lazy: trocarSenha },
          { path: '*', element: <NaoEncontrada /> },
        ],
      },
    ],
  },
]

export const rotas = createBrowserRouter(definicaoRotas)
