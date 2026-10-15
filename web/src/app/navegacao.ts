import {
  Bell,
  CalendarDays,
  ChartColumn,
  House,
  LayoutGrid,
  ListChecks,
  Pill,
  Plane,
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
export const navegacaoSecundaria: ItemNavegacao[] = [
  { rota: '/rotina', rotulo: 'Rotina', icone: ListChecks },
  { rota: '/viagens', rotulo: 'Viagens', icone: Plane },
  { rota: '/compras', rotulo: 'Compras', icone: ShoppingCart },
]

export const navegacaoConfiguracoes: ItemNavegacao[] = [
  { rota: '/notificacoes', rotulo: 'Notificações', icone: Bell },
  { rota: '/categorias', rotulo: 'Categorias', icone: Tags },
  { rota: '/imoveis', rotulo: 'Imóveis', icone: House },
  { rota: '/relatorio', rotulo: 'Relatório de gastos', icone: ChartColumn },
]
