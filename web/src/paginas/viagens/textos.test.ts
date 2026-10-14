import { describe, expect, test } from 'vitest'
import { descreverPeriodo, formatarTamanho, situacaoViagem } from './textos'

const hoje = '2026-10-13'

describe('descreverPeriodo', () => {
  test('mesmo mês', () => expect(descreverPeriodo('2026-12-20', '2026-12-27', hoje)).toBe('20 a 27 de dezembro'))
  test('meses diferentes no mesmo ano', () =>
    expect(descreverPeriodo('2026-10-30', '2026-11-02', hoje)).toBe('30 de outubro a 2 de novembro'))
  test('virada de ano mostra o ano só onde não é o corrente', () =>
    expect(descreverPeriodo('2026-12-20', '2027-01-05', hoje)).toBe('20 de dezembro a 5 de janeiro de 2027'))
  test('ano que vem inteiro', () =>
    expect(descreverPeriodo('2027-02-01', '2027-03-01', hoje)).toBe('1 de fevereiro a 1 de março de 2027'))
  test('sem volta', () => expect(descreverPeriodo('2026-11-01', null, hoje)).toBe('1 de novembro'))
})

describe('situacaoViagem', () => {
  test('próxima', () => {
    expect(situacaoViagem('2026-10-14', '2026-10-16', hoje)).toEqual({ fase: 'proxima', texto: 'Começa amanhã' })
    expect(situacaoViagem('2026-10-20', null, hoje)).toEqual({ fase: 'proxima', texto: 'Começa em 7 dias' })
    expect(situacaoViagem('2027-04-13', null, hoje).texto).toBe('Começa em 6 meses')
  })
  test('em andamento', () => {
    expect(situacaoViagem('2026-10-13', '2026-10-15', hoje)).toEqual({ fase: 'agora', texto: 'Começa hoje' })
    expect(situacaoViagem('2026-10-10', '2026-10-13', hoje).texto).toBe('Volta hoje')
    expect(situacaoViagem('2026-10-10', '2026-10-14', hoje).texto).toBe('Em viagem, volta amanhã')
    expect(situacaoViagem('2026-10-10', '2026-10-20', hoje).texto).toBe('Em viagem, volta em 7 dias')
    expect(situacaoViagem('2026-10-13', null, hoje).texto).toBe('É hoje')
  })
  test('passada', () => {
    expect(situacaoViagem('2026-10-01', '2026-10-12', hoje).fase).toBe('passada')
    expect(situacaoViagem('2026-10-12', null, hoje).fase).toBe('passada')
  })
})

test('formatarTamanho', () => {
  expect(formatarTamanho(300)).toBe('1 KB')
  expect(formatarTamanho(230 * 1024)).toBe('230 KB')
  expect(formatarTamanho(1.5 * 1024 * 1024)).toBe('1,5 MB')
})
