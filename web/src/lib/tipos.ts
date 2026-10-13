// Tipos do contrato da API (docs/arquitetura.md do back-end). Campos em camelCase.

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
