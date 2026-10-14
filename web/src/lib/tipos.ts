// Tipos do contrato da API (docs/arquitetura.md). Campos em camelCase; datas como string ISO.

export type Usuario = {
  id: string
  nome: string
  email: string
  criadoEm: string
}

export type Sessao = {
  token: string
  usuario: Usuario
}

export type Imovel = { id: string; nome: string; ordem: number }

export type CategoriaPagamento = { id: string; nome: string; ordem: number }

export type StatusPagamento = 'pendente' | 'pago'
export type Recorrencia = 'nenhuma' | 'mensal' | 'anual'

export type Pagamento = {
  id: string
  descricao: string
  categoriaId: string
  categoriaNome: string
  imovelId: string | null
  imovelNome: string | null
  /** Em parcelas, é o valor de cada parcela. */
  valorCentavos: number
  vencimento: string
  status: StatusPagamento
  dataPagamento: string | null
  /** Pendente com vencimento antes de hoje (calculado pelo back-end). */
  vencido: boolean
  recorrencia: Recorrencia
  recorrenciaOrigemId: string | null
  parcelamentoGrupoId: string | null
  parcelaAtual: number | null
  parcelaTotal: number | null
  observacoes: string | null
  criadoEm: string
  atualizadoEm: string
}

/** Corpo de PUT /pagamentos/:id (todos os campos gravados). */
export type PagamentoEdicao = {
  descricao: string
  categoriaId: string
  imovelId: string | null
  valorCentavos: number
  vencimento: string
  status: StatusPagamento
  dataPagamento: string | null
  recorrencia: Recorrencia
  observacoes: string | null
}

/** Corpo de POST /pagamentos. Com `parcelamento`, a resposta é um array de parcelas. */
export type PagamentoCriacao = PagamentoEdicao & { parcelamento?: { totalParcelas: number } }

export type FiltrosPagamento = {
  inicio?: string
  fim?: string
  status?: StatusPagamento
  categoriaId?: string
  imovelId?: string
}

export type AgruparGastosPor = 'imovel' | 'categoria'

export type RelatorioGastos = {
  inicio: string
  fim: string
  agruparPor: AgruparGastosPor
  totalPagoCentavos: number
  totalPrevistoCentavos: number
  /** `id: null` = pagamentos sem imóvel ("Sem imóvel"). */
  itens: { id: string | null; nome: string; pagoCentavos: number; previstoCentavos: number }[]
}

export type TipoEvento =
  | 'reuniao_pessoal'
  | 'exame'
  | 'consulta'
  | 'video'
  | 'programa_radio'
  | 'fisioterapia'
  | 'atividade_fisica'
export type ModalidadeEvento = 'presencial' | 'telemedicina' | 'videoconferencia' | 'podcast' | 'gravacao'
export type RecorrenciaEvento = 'nenhuma' | 'diaria' | 'semanal' | 'mensal' | 'anual'

/** Corpo de POST/PUT /eventos. `inicio`/`fim` em ISO 8601 com fuso. */
export type EventoCorpo = {
  titulo: string
  tipo: TipoEvento
  modalidade: ModalidadeEvento | null
  inicio: string
  fim: string | null
  local: string | null
  link: string | null
  observacoes: string | null
  recorrencia: RecorrenciaEvento
  recorrenciaFim: string | null
  lembretesMinutosAntes: number[]
}

/**
 * Evento como a API devolve. Na listagem, cada ocorrência de uma série vem separada, com o `id`
 * da série e `inicio`/`fim` daquela ocorrência; `inicioSerie` é o `inicio` a mandar no PUT.
 */
export type Evento = EventoCorpo & {
  id: string
  recorrente: boolean
  inicioSerie: string
  criadoEm: string
  atualizadoEm: string
}

export type FiltrosEvento = { inicio?: string; fim?: string; tipo?: TipoEvento }

export type PeriodoRemedio = 'manha' | 'tarde' | 'noite' | 'semanal'

export type HorarioRemedio = {
  id: string
  periodo: PeriodoRemedio
  hora: string | null
  /** 0 = domingo ... 6 = sábado. Só no semanal. */
  diaSemana: number | null
}

export type Medicamento = {
  id: string
  nome: string
  dose: string | null
  observacoes: string | null
  ativo: boolean
  horarios: HorarioRemedio[]
  criadoEm: string
  atualizadoEm: string
}

/** Corpo de POST/PUT. No PUT, horário com `id` é mantido (com o histórico); sem `id` é novo. */
export type MedicamentoCorpo = {
  nome: string
  dose: string | null
  observacoes: string | null
  ativo: boolean
  horarios: (Omit<HorarioRemedio, 'id'> & { id?: string })[]
}

/** Item de GET /medicamentos/hoje: uma dose do dia com o status. */
export type DoseDoDia = {
  horarioId: string
  medicamentoId: string
  nome: string
  dose: string | null
  observacoes: string | null
  periodo: PeriodoRemedio
  hora: string | null
  data: string
  tomado: boolean
  tomadoEm: string | null
}

// ---- Rotina (etapa 7 do back-end) ----

export type Rotina = {
  id: string
  titulo: string
  hora: string | null
  /** 0 = domingo ... 6 = sábado; pelo menos um. */
  diasSemana: number[]
  ativo: boolean
  ordem: number
  lembrete: boolean
  criadoEm: string
  atualizadoEm: string
}

export type RotinaCorpo = Pick<Rotina, 'titulo' | 'hora' | 'diasSemana' | 'ativo' | 'lembrete'> & { ordem?: number }

/** Item de GET /rotinas/hoje: uma tarefa do dia com o status. */
export type TarefaDoDia = {
  rotinaId: string
  titulo: string
  hora: string | null
  ordem: number
  data: string
  concluida: boolean
  concluidaEm: string | null
}

/** GET /hoje: cada lista no mesmo formato do seu módulo. */
export type PainelHoje = {
  data: string
  resumo: {
    eventos: number
    remediosPendentes: number
    tarefasPendentes: number
    pagamentosVencidos: number
    pagamentosAVencer: number
  }
  eventos: Evento[]
  medicamentos: DoseDoDia[]
  rotina: TarefaDoDia[]
  pagamentos: {
    /** Pendentes com vencimento antes do dia. */
    vencidos: Pagamento[]
    /** Pendentes que vencem do dia até 7 dias depois. */
    aVencer: Pagamento[]
    totalVencidoCentavos: number
    totalAVencerCentavos: number
  }
}

// ---- Viagens (etapa 9 do back-end) ----

export type AnexoViagem = {
  id: string
  nomeOriginal: string
  /** Detectado pelo conteúdo no servidor: PDF, JPG, PNG, WEBP ou HEIC. */
  mimeType: string
  tamanhoBytes: number
  criadoEm: string
}

export type Viagem = {
  id: string
  destino: string
  ida: string
  volta: string | null
  hospedagem: string | null
  transporte: string | null
  observacoes: string | null
  anexos: AnexoViagem[]
  criadoEm: string
  atualizadoEm: string
}

export type ViagemCorpo = Pick<Viagem, 'destino' | 'ida' | 'volta' | 'hospedagem' | 'transporte' | 'observacoes'>
