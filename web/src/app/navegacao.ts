import {
  Bell,
  CalendarDays,
  ChartColumn,
  Dumbbell,
  HeartPulse,
  House,
  LayoutGrid,
  ListChecks,
  Pill,
  Plane,
  Radio,
  ShoppingCart,
  Sun,
  Tags,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type ItemNavegacao = { rota: string; rotulo: string; icone: LucideIcon }

/** Barra inferior do celular: as quatro áreas de uso diário e "Mais". */
export const navegacaoPrincipal: ItemNavegacao[] = [
  { rota: '/', rotulo: 'Hoje', icone: Sun },
  { rota: '/agenda', rotulo: 'Agenda', icone: CalendarDays },
  { rota: '/pagamentos', rotulo: 'Contas', icone: Wallet },
  { rota: '/remedios', rotulo: 'Remédios', icone: Pill },
]

export const itemMais: ItemNavegacao = { rota: '/mais', rotulo: 'Mais', icone: LayoutGrid }

/** Áreas que ficam em "Mais" no celular e direto na barra lateral do computador. */
// Na ordem da lista da Débora. Rádio, Atividade física e Fisioterapia são a agenda só daquele tipo
// (paginas/agenda/AgendaDoTipo.tsx; rotas em AREAS_DO_TIPO de paginas/agenda/textos.ts).
export const navegacaoSecundaria: ItemNavegacao[] = [
  { rota: '/rotina', rotulo: 'Compromissos', icone: ListChecks },
  { rota: '/radio', rotulo: 'Programa de rádio', icone: Radio },
  { rota: '/viagens', rotulo: 'Viagens', icone: Plane },
  { rota: '/atividade-fisica', rotulo: 'Atividade física', icone: Dumbbell },
  { rota: '/fisioterapia', rotulo: 'Fisioterapia', icone: HeartPulse },
  { rota: '/compras', rotulo: 'Compras', icone: ShoppingCart },
]

export const navegacaoConfiguracoes: ItemNavegacao[] = [
  { rota: '/notificacoes', rotulo: 'Notificações', icone: Bell },
  { rota: '/categorias', rotulo: 'Categorias', icone: Tags },
  { rota: '/imoveis', rotulo: 'Imóveis', icone: House },
  { rota: '/relatorio', rotulo: 'Relatório de gastos', icone: ChartColumn },
]
