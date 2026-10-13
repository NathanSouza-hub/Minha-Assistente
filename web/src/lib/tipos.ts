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
