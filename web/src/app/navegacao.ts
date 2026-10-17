import {
  AirplaneTiltIcon,
  BasketIcon,
  BellIcon,
  CalendarDotsIcon,
  ChartBarIcon,
  CheckSquareIcon,
  HeartbeatIcon,
  HouseIcon,
  MicrophoneStageIcon,
  PersonSimpleRunIcon,
  PillIcon,
  SquaresFourIcon,
  SunIcon,
  TagIcon,
  WalletIcon,
  type Icon,
} from '@phosphor-icons/react'

/** Cada área tem um par de cores (`.area-<nome>` em index.css; tabela em docs/identidade-visual.md). */
export type Area =
  | 'hoje'
  | 'agenda'
  | 'contas'
  | 'remedios'
  | 'compromissos'
  | 'viagens'
  | 'compras'
  | 'radio'
  | 'atividade'
  | 'fisioterapia'
  | 'geral'

export type ItemNavegacao = { rota: string; rotulo: string; icone: Icon; area: Area }

/** Barra inferior do celular: as quatro áreas de uso diário e "Mais". */
export const navegacaoPrincipal: ItemNavegacao[] = [
  { rota: '/', rotulo: 'Hoje', icone: SunIcon, area: 'hoje' },
  { rota: '/agenda', rotulo: 'Agenda', icone: CalendarDotsIcon, area: 'agenda' },
  { rota: '/pagamentos', rotulo: 'Contas', icone: WalletIcon, area: 'contas' },
  { rota: '/remedios', rotulo: 'Remédios', icone: PillIcon, area: 'remedios' },
]

export const itemMais: ItemNavegacao = { rota: '/mais', rotulo: 'Mais', icone: SquaresFourIcon, area: 'geral' }

/** Áreas que ficam em "Mais" no celular e direto na barra lateral do computador. */
// Na ordem da lista da Débora. Rádio, Atividade física e Fisioterapia são a agenda só daquele tipo
// (paginas/agenda/AgendaDoTipo.tsx; rotas em AREAS_DO_TIPO de paginas/agenda/textos.ts).
export const navegacaoSecundaria: ItemNavegacao[] = [
  { rota: '/rotina', rotulo: 'Compromissos', icone: CheckSquareIcon, area: 'compromissos' },
  { rota: '/radio', rotulo: 'Programa de rádio', icone: MicrophoneStageIcon, area: 'radio' },
  { rota: '/viagens', rotulo: 'Viagens', icone: AirplaneTiltIcon, area: 'viagens' },
  { rota: '/atividade-fisica', rotulo: 'Atividade física', icone: PersonSimpleRunIcon, area: 'atividade' },
  { rota: '/fisioterapia', rotulo: 'Fisioterapia', icone: HeartbeatIcon, area: 'fisioterapia' },
  { rota: '/compras', rotulo: 'Compras', icone: BasketIcon, area: 'compras' },
]

export const navegacaoConfiguracoes: ItemNavegacao[] = [
  { rota: '/notificacoes', rotulo: 'Notificações', icone: BellIcon, area: 'geral' },
  { rota: '/categorias', rotulo: 'Categorias', icone: TagIcon, area: 'contas' },
  { rota: '/imoveis', rotulo: 'Imóveis', icone: HouseIcon, area: 'contas' },
  { rota: '/relatorio', rotulo: 'Relatório de gastos', icone: ChartBarIcon, area: 'contas' },
]

// Telas que não estão no menu mas pertencem a uma área.
const outrasRotas: { rota: string; area: Area }[] = [{ rota: '/equipe', area: 'contas' }]

const todasAsRotas = [
  ...navegacaoPrincipal,
  ...navegacaoSecundaria,
  ...navegacaoConfiguracoes,
  itemMais,
  ...outrasRotas,
]

/** Área da tela aberta, pela rota mais específica que a contém (`/` só vale exato). */
export function areaDaRota(caminho: string): Area {
  if (caminho === '/') return 'hoje'
  const encontrada = todasAsRotas
    .filter((item) => item.rota !== '/' && (caminho === item.rota || caminho.startsWith(`${item.rota}/`)))
    .sort((a, b) => b.rota.length - a.rota.length)[0]
  return encontrada?.area ?? 'geral'
}
