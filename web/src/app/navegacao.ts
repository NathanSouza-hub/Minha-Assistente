import {
  CalendarDotsIcon,
  CheckSquareIcon,
  GearSixIcon,
  HeartbeatIcon,
  SunIcon,
  WalletIcon,
  type Icon,
} from '@phosphor-icons/react'

/** Cada área tem um par de cores (`.area-<nome>` em index.css; tabela em docs/identidade-visual.md). */
export type Area =
  | 'hoje'
  | 'agenda'
  | 'contas'
  | 'recebiveis'
  | 'tarefas'
  | 'remedios'
  | 'compromissos'
  | 'viagens'
  | 'compras'
  | 'radio'
  | 'atividade'
  | 'fisioterapia'
  | 'geral'

/**
 * Item do menu interno de uma seção. `rota` pode ter query (ex.: `/despesas?imovel=pessoal`): o item
 * fica marcado quando o caminho e esses parâmetros batem. `prefixos` são outros caminhos que
 * pertencem a ele (ex.: `/equipe/...` é da Equipe).
 */
export type ItemSecao = { rota: string; rotulo: string; prefixos?: string[] }

/** Uma das 6 áreas principais (barra do celular e barra lateral). */
/** `rotuloCurto`: o nome na barra do celular, quando o completo não cabe (5 itens em 360px). */
export type Secao = {
  id: string
  rota: string
  rotulo: string
  rotuloCurto?: string
  icone: Icon
  area: Area
  itens: ItemSecao[]
}

export const SECOES: Secao[] = [
  // Só as atividades do dia (tela Hoje).
  { id: 'inicio', rota: '/', rotulo: 'Início', icone: SunIcon, area: 'hoje', itens: [] },
  {
    id: 'financas',
    rota: '/financas',
    rotulo: 'Finanças',
    icone: WalletIcon,
    area: 'contas',
    itens: [
      { rota: '/financas', rotulo: 'Visão geral' },
      { rota: '/pagamentos', rotulo: 'Contas a pagar' },
      { rota: '/despesas', rotulo: 'Lista de despesas' },
      { rota: '/despesas?imovel=pessoal', rotulo: 'Pessoais' },
      { rota: '/imoveis', rotulo: 'Residências' },
      { rota: '/pagamentos?aba=equipe', rotulo: 'Equipe', prefixos: ['/equipe'] },
      { rota: '/recebiveis', rotulo: 'Recebíveis' },
      { rota: '/pagamentos?aba=cartoes', rotulo: 'Cartões', prefixos: ['/cartoes'] },
      { rota: '/relatorio', rotulo: 'Relatório' },
      { rota: '/categorias', rotulo: 'Categorias' },
    ],
  },
  {
    id: 'agenda',
    rota: '/agenda',
    rotulo: 'Agenda',
    icone: CalendarDotsIcon,
    area: 'agenda',
    itens: [
      { rota: '/agenda', rotulo: 'Agendamentos' },
      { rota: '/viagens', rotulo: 'Viagens' },
      { rota: '/radio', rotulo: 'Programa de rádio' },
    ],
  },
  {
    id: 'saude',
    rota: '/remedios',
    rotulo: 'Saúde',
    icone: HeartbeatIcon,
    area: 'remedios',
    itens: [
      { rota: '/remedios', rotulo: 'Medicamentos' },
      { rota: '/consultas', rotulo: 'Consultas' },
      { rota: '/exames', rotulo: 'Exames' },
      { rota: '/fisioterapia', rotulo: 'Fisioterapia' },
      { rota: '/atividade-fisica', rotulo: 'Atividade física' },
    ],
  },
  {
    id: 'compromissos',
    rota: '/rotina',
    rotulo: 'Compromissos',
    rotuloCurto: 'Lembretes',
    icone: CheckSquareIcon,
    area: 'compromissos',
    itens: [
      { rota: '/rotina', rotulo: 'Lembretes que repetem' },
      { rota: '/tarefas', rotulo: 'Lembretes de uma vez' },
      { rota: '/compras', rotulo: 'Lista de compras' },
    ],
  },
  {
    id: 'configuracoes',
    rota: '/configuracoes',
    rotulo: 'Configurações',
    icone: GearSixIcon,
    area: 'geral',
    itens: [
      { rota: '/configuracoes', rotulo: 'Geral' },
      { rota: '/notificacoes', rotulo: 'Notificações' },
    ],
  },
]

/** Barra do celular: as 5 áreas de uso (Configurações abre pelo Início e pela barra lateral). */
export const SECOES_DA_BARRA = SECOES.filter((s) => s.id !== 'configuracoes')

const separar = (rota: string) => {
  const [caminho, busca = ''] = rota.split('?')
  return { caminho, parametros: new URLSearchParams(busca) }
}

const pertence = (caminho: string, base: string) => caminho === base || caminho.startsWith(`${base}/`)

/** Quanto o item casa com a tela aberta (0 = não casa; parâmetros que batem valem mais). */
function pontuar(item: ItemSecao, caminho: string, busca: URLSearchParams) {
  const alvo = separar(item.rota)
  const doItem = alvo.caminho === caminho
  const doPrefixo = (item.prefixos ?? []).some((p) => pertence(caminho, p))
  const abaixo = alvo.caminho !== '/' && caminho.startsWith(`${alvo.caminho}/`)
  if (!doItem && !doPrefixo && !abaixo) return 0
  const exigidos = [...alvo.parametros.entries()]
  if (doItem && exigidos.some(([chave, valor]) => busca.get(chave) !== valor)) return 0
  if (doPrefixo) return 3
  return doItem ? 2 + exigidos.length : 1
}

/** Seção e item do menu interno da tela aberta. A Início só vale no caminho exato. */
export function secaoDaTela(caminho: string, buscaTexto = '') {
  const busca = new URLSearchParams(buscaTexto)
  if (caminho === '/') return { secao: SECOES[0], item: undefined, exato: true }
  let melhor: { secao: Secao; item?: ItemSecao; pontos: number } | undefined
  for (const secao of SECOES) {
    for (const item of secao.itens) {
      const pontos = pontuar(item, caminho, busca)
      if (pontos > (melhor?.pontos ?? 0)) melhor = { secao, item, pontos }
    }
  }
  if (!melhor) return { secao: undefined, item: undefined, exato: false }
  // "Exato": a tela é a de um item (lista), não um formulário dentro dele — só aí o menu interno aparece.
  const exato = melhor.item ? separar(melhor.item.rota).caminho === caminho : false
  return { secao: melhor.secao, item: melhor.item, exato }
}

// Cor de cada tela (a fita embaixo do cabeçalho e os selos), pela rota mais específica.
const AREAS_DAS_ROTAS: { rota: string; area: Area }[] = [
  { rota: '/financas', area: 'contas' },
  { rota: '/pagamentos', area: 'contas' },
  { rota: '/despesas', area: 'contas' },
  { rota: '/equipe', area: 'contas' },
  { rota: '/cartoes', area: 'contas' },
  { rota: '/imoveis', area: 'contas' },
  { rota: '/relatorio', area: 'contas' },
  { rota: '/categorias', area: 'contas' },
  { rota: '/recebiveis', area: 'recebiveis' },
  { rota: '/agenda', area: 'agenda' },
  { rota: '/viagens', area: 'viagens' },
  { rota: '/radio', area: 'radio' },
  { rota: '/remedios', area: 'remedios' },
  { rota: '/consultas', area: 'remedios' },
  { rota: '/exames', area: 'remedios' },
  { rota: '/fisioterapia', area: 'fisioterapia' },
  { rota: '/atividade-fisica', area: 'atividade' },
  { rota: '/rotina', area: 'compromissos' },
  { rota: '/tarefas', area: 'tarefas' },
  { rota: '/compras', area: 'compras' },
  { rota: '/notificacoes', area: 'geral' },
  { rota: '/configuracoes', area: 'geral' },
]

/** Área (cor) da tela aberta, pela rota mais específica que a contém (`/` = Início). */
export function areaDaRota(caminho: string): Area {
  if (caminho === '/') return 'hoje'
  const encontrada = AREAS_DAS_ROTAS.filter((item) => pertence(caminho, item.rota)).sort(
    (a, b) => b.rota.length - a.rota.length,
  )[0]
  return encontrada?.area ?? 'geral'
}
