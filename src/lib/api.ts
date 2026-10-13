// Cliente da API. Erros seguem o contrato { erro: { codigo, mensagem } } e viram ApiError.
import { lerToken } from './sessao'

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly codigo: string

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem)
    this.name = 'ApiError'
    this.status = status
    this.codigo = codigo
  }
}

// Chamado quando a API responde NAO_AUTORIZADO (token vencido ou inválido).
let aoPerderSessao: () => void = () => {}
export const definirAoPerderSessao = (fn: () => void) => {
  aoPerderSessao = fn
}

type Opcoes = Omit<RequestInit, 'body'> & {
  /** Objeto vira JSON; FormData vai como multipart. */
  corpo?: unknown
  /** Filtros da listagem; valores vazios são ignorados. */
  query?: Record<string, string | number | boolean | null | undefined>
}

function montarUrl(caminho: string, query?: Opcoes['query']) {
  const url = new URL(API_URL + caminho)
  for (const [chave, valor] of Object.entries(query ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(chave, String(valor))
  }
  return url.toString()
}

export async function api<T>(caminho: string, { corpo, query, headers, ...resto }: Opcoes = {}): Promise<T> {
  const cabecalhos = new Headers(headers)
  const token = lerToken()
  if (token) cabecalhos.set('Authorization', `Bearer ${token}`)

  let body: BodyInit | undefined
  if (corpo instanceof FormData) {
    body = corpo
  } else if (corpo !== undefined) {
    cabecalhos.set('Content-Type', 'application/json')
    body = JSON.stringify(corpo)
  }

  let resposta: Response
  try {
    resposta = await fetch(montarUrl(caminho, query), { ...resto, headers: cabecalhos, body })
  } catch {
    throw new ApiError(0, 'SEM_CONEXAO', 'Sem conexão com o servidor. Verifique sua internet e tente de novo.')
  }

  if (resposta.status === 204) return undefined as T

  const dados = await resposta.json().catch(() => null)
  if (resposta.ok) return dados as T

  const erro = dados?.erro
  const apiErro = new ApiError(
    resposta.status,
    erro?.codigo ?? 'ERRO_INTERNO',
    erro?.mensagem ?? 'Não foi possível concluir. Tente de novo em instantes.',
  )
  if (apiErro.codigo === 'NAO_AUTORIZADO') aoPerderSessao()
  throw apiErro
}
