import {
  CalendarDotsIcon,
  CheckSquareIcon,
  GearSixIcon,
  PillIcon,
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

/**
 * Cartões e Categorias estão ocultos do menu por enquanto (decisão 33): as rotas, as telas e os dados
 * continuam, só não aparecem na navegação. Para reativar, troque para `true`.
 * Sem a tela Categorias, a categoria nova se cria no próprio cadastro ("+ Nova categoria…").
 */
export const CARTOES_VISIVEIS = false
export const CATEGORIAS_VISIVEIS = false

const visiveis = (itens: (ItemSecao | false)[]) => itens.filter((i): i is ItemSecao => Boolean(i))

export const SECOES: Secao[] = [
  // Só as atividades do dia (tela Hoje).
  { id: 'inicio', rota: '/', rotulo: 'Início', icone: SunIcon, area: 'hoje', itens: [] },
  {
    id: 'financas',
    rota: '/financas',
    rotulo: 'Finanças',
    icone: WalletIcon,
    area: 'contas',
    itens: visiveis([
      { rota: '/pagamentos', rotulo: 'Contas a pagar' },
      { rota: '/despesas', rotulo: 'Lista de despesas' },
      { rota: '/despesas?imovel=pessoal', rotulo: 'Pessoais' },
      { rota: '/imoveis', rotulo: 'Residências' },
      { rota: '/pagamentos?aba=equipe', rotulo: 'Equipe', prefixos: ['/equipe'] },
      { rota: '/recebiveis', rotulo: 'Recebíveis' },
      { rota: '/financas', rotulo: 'Visão geral' },
      CARTOES_VISIVEIS && { rota: '/pagamentos?aba=cartoes', rotulo: 'Cartões', prefixos: ['/cartoes'] },
      CATEGORIAS_VISIVEIS && { rota: '/categorias', rotulo: 'Categorias' },
    ]),
  },
  {
    id: 'agenda',
    rota: '/agenda',
    rotulo: 'Agenda',
    icone: CalendarDotsIcon,
    area: 'agenda',
    // Viagens e Programa de rádio saíram do menu (decisão 34): nascem no "+ Novo" da Agenda e aparecem
    // no calendário; as telas /viagens e /radio continuam e contam como Agenda. Consultas, exames,
    // fisioterapia e atividade física são tipos de agendamento: as telas continuam e também contam
    // como Agenda (saíram do menu de Saúde, que virou Medicamentos).
    itens: [
      {
        rota: '/agenda',
        rotulo: 'Agendamentos',
        prefixos: ['/viagens', '/radio', '/consultas', '/exames', '/fisioterapia', '/atividade-fisica'],
      },
    ],
  },
  {
    id: 'medicamentos',
    rota: '/remedios',
    rotulo: 'Medicamentos',
    rotuloCurto: 'Remédios',
    icone: PillIcon,
    area: 'remedios',
    // Um item só: sem menu interno.
    itens: [{ rota: '/remedios', rotulo: 'Medicamentos' }],
  },
  {
    id: 'compromissos',
    rota: '/rotina',
    rotulo: 'Lembretes',
    icone: CheckSquareIcon,
    area: 'compromissos',
    itens: [
      { rota: '/rotina', rotulo: 'Lembretes que repetem' },
      { rota: '/tarefas', rotulo: 'Lembretes de uma vez' },
      { rota: '/compras', rotulo: 'Lista de compras' },
      { rota: '/produtividade', rotulo: 'O que foi feito' },
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
  { rota: '/categorias', area: 'contas' },
  { rota: '/recebiveis', area: 'recebiveis' },
  { rota: '/agenda', area: 'agenda' },
  { rota: '/viagens', area: 'viagens' },
  { rota: '/radio', area: 'radio' },
  { rota: '/remedios', area: 'remedios' },
  { rota: '/consultas', area: 'agenda' },
  { rota: '/exames', area: 'agenda' },
  { rota: '/fisioterapia', area: 'fisioterapia' },
  { rota: '/atividade-fisica', area: 'atividade' },
  { rota: '/rotina', area: 'compromissos' },
  { rota: '/tarefas', area: 'tarefas' },
  { rota: '/compras', area: 'compras' },
  { rota: '/produtividade', area: 'tarefas' },
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
