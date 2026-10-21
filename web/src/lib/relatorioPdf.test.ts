import { describe, expect, test } from 'vitest'
import type { RelatorioFinanceiro, RelatorioGastos } from '@/lib/tipos'
import { montarRelatorioPdf, nomeDoPdf } from './relatorioPdf'

const contas = { totalCentavos: 500000, pagoCentavos: 300000, pendenteCentavos: 200000, vencidoCentavos: 50000 }

const financeiro: RelatorioFinanceiro = {
  inicio: '2026-10-01',
  fim: '2026-10-31',
  saidas: { ...contas, pagoNoPeriodoCentavos: 310000, contasADefinir: 2 },
  entradas: {
    totalCentavos: 800000,
    recebidoCentavos: 450000,
    pendenteCentavos: 350000,
    vencidoCentavos: 0,
    recebidoNoPeriodoCentavos: 460000,
    porOrigem: [{ origem: 'aluguel', totalCentavos: 320000, recebidoCentavos: 200000, pendenteCentavos: 120000 }],
  },
  saldo: { realizadoCentavos: 150000, projetadoCentavos: -12345 },
  imoveis: [],
  pessoal: { ...contas, categorias: [{ id: null, nome: 'Outros', totalCentavos: 98765 }] },
}

const gastos: RelatorioGastos = {
  inicio: '2026-10-01',
  fim: '2026-10-31',
  agruparPor: 'categoria',
  totalPagoCentavos: 300000,
  totalPrevistoCentavos: 200000,
  itens: [{ id: 'c1', nome: 'Contas residenciais', pagoCentavos: 300000, previstoCentavos: 200000 }],
}

// Sem compressão (padrão do jsPDF), o texto fica legível no conteúdo do arquivo.
const textoDo = async () =>
  (await montarRelatorioPdf({ periodo: { inicio: '2026-10-01', fim: '2026-10-31' }, financeiro, gastos })).output()

describe('PDF do relatório', () => {
  test('tem título, período e os números do relatório, sem recalcular', async () => {
    const pdf = await textoDo()
    expect(pdf.startsWith('%PDF-')).toBe(true)
    expect(pdf).toContain('01/10/2026 a 31/10/2026')
    for (const valor of ['R$ 8.000,00', 'R$ 3.100,00', 'R$ 1.500,00', '-R$ 123,45', 'R$ 987,65', 'R$ 3.200,00'])
      expect(pdf).toContain(valor)
    // O "Separar por" escolhido na tela.
    expect(pdf).toContain('Gastos por categoria')
    expect(pdf).toContain('Contas residenciais')
    expect(pdf).toContain('Aluguel')
    expect(pdf).toContain('2 contas da equipe com valor a definir')
  })

  test('nome do arquivo com o período', () => {
    expect(nomeDoPdf({ inicio: '2026-01-01', fim: '2026-12-31' })).toBe('relatorio-2026-01-01-a-2026-12-31.pdf')
  })
})
