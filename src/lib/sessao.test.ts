import { describe, expect, test } from 'vitest'
import { tokenExpirado } from './sessao'

const jwtCom = (payload: object) =>
  `cabecalho.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.assinatura`

describe('tokenExpirado', () => {
  const agora = Date.UTC(2026, 9, 13, 12)

  test('token com exp no futuro é válido', () => {
    expect(tokenExpirado(jwtCom({ exp: agora / 1000 + 60 }), agora)).toBe(false)
  })

  test('token com exp no passado ou agora está expirado', () => {
    expect(tokenExpirado(jwtCom({ exp: agora / 1000 - 1 }), agora)).toBe(true)
    expect(tokenExpirado(jwtCom({ exp: agora / 1000 }), agora)).toBe(true)
  })

  test('sem token, sem exp ou malformado conta como expirado', () => {
    expect(tokenExpirado(null, agora)).toBe(true)
    expect(tokenExpirado(jwtCom({ sub: 'x' }), agora)).toBe(true)
    expect(tokenExpirado('isso-nao-e-jwt', agora)).toBe(true)
  })
})
