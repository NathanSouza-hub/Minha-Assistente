import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { montarListaComprasPdf, nomeDoPdfCompras } from './comprasPdf'

const item = (nome: string, categoria: string | null, quantidade: string | null = null, comprado = false) => ({
  nome,
  categoria,
  quantidade,
  comprado,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T10:00:00-03:00'))
})
afterEach(() => vi.useRealTimers())

// Sem compressão (padrão do jsPDF), o texto fica legível no conteúdo do arquivo.
const textoDo = async (...args: Parameters<typeof montarListaComprasPdf>) => (await montarListaComprasPdf(...args)).output()

describe('PDF da lista de compras', () => {
  test('título, data, categorias (sem categoria no fim) e quantidades', async () => {
    const pdf = await textoDo({
      titulo: 'Compras do sábado',
      itens: [item('Pilhas AA', null), item('Arroz', 'Mercado', '5 kg'), item('Dipirona', 'Farmácia')],
    })
    expect(pdf.startsWith('%PDF-')).toBe(true)
    for (const texto of ['Compras do s', '13/10/2026', '3 itens', 'MERCADO', 'Arroz', '5 kg', 'Dipirona', 'SEM CATEGORIA'])
      expect(pdf).toContain(texto)
    expect(pdf.indexOf('MERCADO')).toBeLessThan(pdf.indexOf('SEM CATEGORIA'))
  })

  test('só itens sem categoria: sem o título "Sem categoria"; título vazio vira o padrão', async () => {
    const pdf = await textoDo({ titulo: '  ', itens: [item('Pilhas AA', null)] })
    expect(pdf).toContain('Lista de compras')
    expect(pdf).toContain('1 item')
    expect(pdf).not.toContain('SEM CATEGORIA')
  })

  test('nome do arquivo com a data de hoje', () => {
    expect(nomeDoPdfCompras()).toBe('lista-de-compras-2026-10-13.pdf')
  })
})
