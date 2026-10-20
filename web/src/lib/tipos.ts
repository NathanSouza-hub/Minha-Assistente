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
  /** Nulo só na fatura de cartão. */
  categoriaId: string | null
  categoriaNome: string | null
  imovelId: string | null
  imovelNome: string | null
  /** Em parcelas, é o valor de cada parcela. Nulo = conta da equipe com valor a definir. */
  valorCentavos: number | null
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
  /** Fatura de cartão: o valor vem das compras; só dá para pagar (PUT/DELETE → FATURA_AUTOMATICA). */
  cartaoId: string | null
  cartaoNome: string | null
  /** Mês da fatura, dia 1 ("2026-11-01"). */
  competencia: string | null
  /** Quantos comprovantes a conta tem (a lista vem em GET /pagamentos/:id). */
  totalComprovantes: number
  /** Conta da equipe (criada pelos dias de pagamento da pessoa): edita só valor, data e observações. */
  membroId: string | null
  membroNome: string | null
  criadoEm: string
  atualizadoEm: string
}

/** GET /pagamentos/:id: a conta com a lista de comprovantes. */
export type PagamentoDetalhe = Pagamento & { comprovantes: Comprovante[] }

/** Corpo de PUT /pagamentos/:id (todos os campos gravados). Na conta da equipe a categoria é
 * nula e o valor pode ficar nulo (a definir). */
export type PagamentoEdicao = {
  descricao: string
  categoriaId: string | null
  imovelId: string | null
  valorCentavos: number | null
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
  /** `pessoal` = contas sem imóvel; `imovel` = com imóvel. */
  destino?: 'pessoal' | 'imovel'
}

export type FormaPagamento = 'mensal' | 'plantao' | 'honorario'

export type DiaPagamento = { dia: number; valorPrevistoCentavos: number | null }

/** Corpo de POST e PUT /equipe. */
export type MembroEquipeCorpo = {
  nome: string
  funcao: string | null
  formaPagamento: FormaPagamento
  chavePix: string | null
  ativo: boolean
  dias: DiaPagamento[]
}

export type MembroEquipe = MembroEquipeCorpo & { id: string }

export type CorCartao = 'azul' | 'roxo' | 'verde' | 'laranja' | 'vermelho' | 'grafite'
export type SituacaoFatura = 'aberta' | 'fechada' | 'paga'

/** Corpo de POST e PUT /cartoes. */
export type CartaoCorpo = {
  nome: string
  final: string | null
  cor: CorCartao
  diaFechamento: number
  diaVencimento: number
  limiteCentavos: number | null
  ordem?: number
}

export type Cartao = Required<CartaoCorpo> & {
  id: string
  /** Limite menos as parcelas em faturas não pagas; nulo sem limite. */
  limiteDisponivelCentavos: number | null
  /** Primeira fatura não paga a partir do mês atual. */
  faturaAtual: { competencia: string; totalCentavos: number; vencimento: string; situacao: SituacaoFatura }
}

/** Corpo de POST e PUT /cartoes/:id/compras. */
export type CompraCartaoCorpo = {
  descricao: string
  valorTotalCentavos: number
  parcelas: number
  dataCompra: string
  categoriaId: string | null
  observacoes: string | null
}

export type CompraCartao = CompraCartaoCorpo & {
  id: string
  cartaoId: string
  /** Faturas (dia 1 do mês) em que caem as parcelas, em ordem. */
  competencias: string[]
}

export type ParcelaFatura = {
  compraId: string
  descricao: string
  categoriaId: string | null
  categoriaNome: string | null
  dataCompra: string
  parcela: number
  totalParcelas: number
  valorCentavos: number
}

/** GET /cartoes/:id/faturas/:AAAA-MM */
export type Fatura = {
  competencia: string
  fechamento: string
  vencimento: string
  situacao: SituacaoFatura
  totalCentavos: number
  /** Conta da fatura em /pagamentos (nula sem compras). */
  pagamentoId: string | null
  parcelas: ParcelaFatura[]
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

export type OrigemRecebivel = 'dividendos' | 'aluguel' | 'rendimentos' | 'honorarios' | 'outros'
/** Derivado dos recebimentos: nada, parte ou tudo (ou encerrado com menos). */
export type StatusRecebivel = 'pendente' | 'parcial' | 'recebido'

export type RecebivelCorpo = {
  descricao: string
  origem: OrigemRecebivel
  valorPrevistoCentavos: number
  dataPrevista: string
  recorrencia: 'nenhuma' | 'mensal' | 'anual'
  observacoes: string | null
}

export type Recebivel = RecebivelCorpo & {
  id: string
  recebidoCentavos: number
  /** Quanto falta (0 quando recebido). */
  saldoCentavos: number
  status: StatusRecebivel
  /** Não recebido com data prevista antes de hoje. */
  atrasado: boolean
  encerrado: boolean
  ultimoRecebimento: string | null
  recorrenciaOrigemId: string | null
  totalComprovantes: number
  criadoEm: string
  atualizadoEm: string
}

export type Recebimento = { id: string; valorCentavos: number; data: string; observacoes: string | null; criadoEm: string }

export type RecebivelDetalhe = Recebivel & { recebimentos: Recebimento[]; comprovantes: Comprovante[] }

export type RecebimentoCorpo = { valorCentavos: number; data?: string; observacoes?: string | null; encerrar?: boolean }

export type FiltrosRecebivel = { inicio?: string; fim?: string; status?: StatusRecebivel; origem?: OrigemRecebivel }

/** Contas com vencimento no período, pela situação (GET /relatorios/financeiro). */
export type ValoresContas = {
  totalCentavos: number
  pagoCentavos: number
  pendenteCentavos: number
  /** Pendentes com vencimento antes de hoje. */
  vencidoCentavos: number
}

export type RelatorioFinanceiro = {
  inicio: string
  fim: string
  saidas: ValoresContas & {
    /** Realizado: pagas com data de pagamento no período, de qualquer vencimento. */
    pagoNoPeriodoCentavos: number
    /** Contas da equipe com valor a definir (somam 0). */
    contasADefinir: number
  }
  /** Recebíveis com data prevista no período. */
  entradas: {
    totalCentavos: number
    recebidoCentavos: number
    pendenteCentavos: number
    vencidoCentavos: number
    /** Realizado: recebimentos com data no período, de qualquer recebível. */
    recebidoNoPeriodoCentavos: number
    porOrigem: { origem: OrigemRecebivel; totalCentavos: number; recebidoCentavos: number; pendenteCentavos: number }[]
  }
  saldo: {
    /** Recebido no período − pago no período. */
    realizadoCentavos: number
    /** Entradas previstas − saídas previstas do período. */
    projetadoCentavos: number
  }
  /** Todos os imóveis, na ordem, mesmo sem contas no período. */
  imoveis: ({ id: string; nome: string } & ValoresContas)[]
  /** Contas sem imóvel (faturas de cartão e equipe incluídas). */
  pessoal: ValoresContas & { categorias: { id: string | null; nome: string; totalCentavos: number }[] }
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

/** Origem de cada tarefa do dia (rádio, atividade e fisioterapia são agendamentos daquele tipo). */
export type CategoriaTarefa =
  | 'remedio'
  | 'despesa'
  | 'agenda'
  | 'compromisso'
  | 'radio'
  | 'viagem'
  | 'atividade'
  | 'fisioterapia'

/** `atrasado` = pendente com horário (ou vencimento) já passado. */
export type StatusTarefa = 'pendente' | 'feito' | 'nao_feito' | 'atrasado'

export type TarefaHoje = {
  /** "<categoria>:<idItem>:<ocorrência>"; vai no PATCH /hoje/:id. */
  id: string
  categoria: CategoriaTarefa
  titulo: string
  /** Ex.: "50 mg" ou "R$ 3.300,00 · Casa da Serra". */
  detalhe: string | null
  /** "08:00"; null = dia todo. */
  horario: string | null
  status: StatusTarefa
  /** Rota do item no app. */
  link: string
  /** Conta da equipe com valor a definir: o ✓ é dado no formulário da conta, com o valor. */
  concluirNoFormulario: boolean
}

/** GET /hoje: as tarefas do dia numa lista só, em ordem de horário ("dia todo" no fim). */
export type TarefasHoje = {
  data: string
  resumo: { programadas: number; concluidas: number; pendentes: number; atrasadas: number }
  tarefas: TarefaHoje[]
}

/** PATCH /hoje/:id. "pendente" desfaz. */
export type MarcacaoTarefa = 'feito' | 'nao_feito' | 'pendente'

// ---- Viagens (etapa 9 do back-end) ----

/** Arquivo enviado (anexo de viagem, comprovante de conta). */
export type ArquivoEnviado = {
  id: string
  nomeOriginal: string
  /** Detectado pelo conteúdo no servidor: PDF, JPG, PNG, WEBP ou HEIC. */
  mimeType: string
  tamanhoBytes: number
  criadoEm: string
}

export type AnexoViagem = ArquivoEnviado
export type Comprovante = ArquivoEnviado

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

// ---- Compras (etapa 10 do back-end) ----

export type ItemCompra = {
  id: string
  nome: string
  categoria: string | null
  /** Texto livre: "2 kg", "6 caixas". */
  quantidade: string | null
  comprado: boolean
  compradoEm: string | null
  criadoEm: string
  atualizadoEm: string
}

export type ItemCompraCorpo = Pick<ItemCompra, 'nome' | 'categoria' | 'quantidade'>

/** GET/PUT /notificacoes/resumo: o resumo da manhã (vem ligado às 07:00). */
export type PreferenciaResumo = { ativo: boolean; hora: string }
