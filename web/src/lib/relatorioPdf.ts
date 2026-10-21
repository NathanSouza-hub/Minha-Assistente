import type { jsPDF } from 'jspdf'
import { salvarNoAparelho } from '@/lib/arquivos'
import { agora, dataCurta } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import type { RelatorioFinanceiro, RelatorioGastos } from '@/lib/tipos'
import { ORIGENS } from '@/paginas/recebiveis/formulario'

export type DadosRelatorioPdf = {
  periodo: { inicio: string; fim: string }
  financeiro: RelatorioFinanceiro
  gastos: RelatorioGastos
}

// Cores da identidade (src/index.css): azul da marca, texto secundário.
const AZUL: [number, number, number] = [31, 79, 209]
const CINZA: [number, number, number] = [90, 100, 120]
const MARGEM = 15

// As fontes padrão do PDF não têm o espaço fino nem o sinal de menos tipográfico do Intl.
const reais = (centavos: number) => formatarCentavos(centavos).replace(/\s/g, ' ').replace('−', '-')

/**
 * Relatório do período em PDF, com os mesmos números da tela (GET /relatorios/financeiro e
 * /relatorios/gastos, já carregados): balanço, saldo, recebíveis por origem, despesas pessoais e os
 * gastos por imóvel ou categoria, conforme o "Separar por" escolhido. Nada é recalculado aqui.
 * O jsPDF só é baixado quando a pessoa pede o PDF.
 */
export async function montarRelatorioPdf({ periodo, financeiro, gastos }: DadosRelatorioPdf) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const largura = doc.internal.pageSize.getWidth()

  // Faixa azul do título, como a capa do app.
  doc.setFillColor(...AZUL)
  doc.rect(0, 0, largura, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold').setFontSize(18)
  doc.text('Relatório financeiro', MARGEM, 14)
  doc.setFont('helvetica', 'normal').setFontSize(11)
  doc.text(`Período: ${dataCurta(periodo.inicio)} a ${dataCurta(periodo.fim)}`, MARGEM, 22)
  doc.text('Minha Assistente', largura - MARGEM, 14, { align: 'right' })
  doc.text(`Gerado em ${agora().toFormat("dd/MM/yyyy 'às' HH:mm")}`, largura - MARGEM, 22, { align: 'right' })
  let y = 40

  const titulo = (texto: string) => {
    if (y > 255) {
      doc.addPage()
      y = 20
    }
    doc.setTextColor(...AZUL)
    doc.setFont('helvetica', 'bold').setFontSize(13)
    doc.text(texto, MARGEM, y)
    y += 3
  }
  const nota = (texto: string) => {
    doc.setTextColor(...CINZA).setFont('helvetica', 'normal').setFontSize(9)
    doc.text(texto, MARGEM, y - 5, { maxWidth: largura - 2 * MARGEM })
    y += 4
  }
  const semDados = (texto: string) => {
    doc.setTextColor(...CINZA).setFont('helvetica', 'normal').setFontSize(10)
    doc.text(texto, MARGEM, y + 5)
    y += 14
  }
  const tabela = (cabecalho: string[], linhas: string[][], rodape?: string[]) => {
    autoTable(doc, {
      startY: y,
      head: [cabecalho],
      body: linhas,
      foot: rodape ? [rodape] : undefined,
      showFoot: 'lastPage',
      margin: { left: MARGEM, right: MARGEM },
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.2, textColor: [30, 35, 45] },
      headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [227, 235, 253], textColor: [20, 47, 134], fontStyle: 'bold' },
      // Da segunda coluna em diante são valores: à direita (no cabeçalho e no total também).
      didParseCell: ({ cell, column }) => {
        if (column.index > 0) cell.styles.halign = 'right'
      },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  const { entradas: e, saidas: s, saldo, pessoal } = financeiro

  titulo('Balanço do período')
  tabela(
    ['', 'Entradas (recebíveis)', 'Saídas (contas)'],
    [
      ['Previsto no período', reais(e.totalCentavos), reais(s.totalCentavos)],
      ['Já recebido / já pago', reais(e.recebidoCentavos), reais(s.pagoCentavos)],
      ['A receber / a pagar', reais(e.pendenteCentavos), reais(s.pendenteCentavos)],
      ['Atrasado / vencido', reais(e.vencidoCentavos), reais(s.vencidoCentavos)],
      ['Realizado no período', reais(e.recebidoNoPeriodoCentavos), reais(s.pagoNoPeriodoCentavos)],
    ],
  )
  nota('Previsto: pela data prevista (recebíveis) e pelo vencimento (contas). Realizado: pela data do recebimento ou do pagamento.')
  if (s.contasADefinir > 0)
    nota(
      `${s.contasADefinir === 1 ? '1 conta da equipe' : `${s.contasADefinir} contas da equipe`} com valor a definir (não entram nas somas).`,
    )

  titulo('Saldo')
  tabela(
    ['', 'Valor', 'Como é calculado'],
    [
      ['Saldo realizado', reais(saldo.realizadoCentavos), 'Recebido no período - pago no período'],
      ['Saldo projetado', reais(saldo.projetadoCentavos), 'Recebíveis previstos - contas do período'],
    ],
  )

  titulo('Recebíveis por origem')
  if (e.porOrigem.length === 0) semDados('Nenhum recebível no período.')
  else
    tabela(
      ['Origem', 'Previsto', 'Recebido', 'A receber'],
      e.porOrigem.map((o) => [
        ORIGENS[o.origem],
        reais(o.totalCentavos),
        reais(o.recebidoCentavos),
        reais(o.pendenteCentavos),
      ]),
      ['Total', reais(e.totalCentavos), reais(e.recebidoCentavos), reais(e.pendenteCentavos)],
    )

  titulo('Despesas pessoais (sem imóvel)')
  if (pessoal.categorias.length === 0) semDados('Nenhuma despesa pessoal no período.')
  else
    tabela(
      ['Categoria', 'Total'],
      pessoal.categorias.map((c) => [c.nome, reais(c.totalCentavos)]),
      [`Total (pago ${reais(pessoal.pagoCentavos)} · a pagar ${reais(pessoal.pendenteCentavos)})`, reais(pessoal.totalCentavos)],
    )

  titulo(gastos.agruparPor === 'imovel' ? 'Gastos por imóvel' : 'Gastos por categoria')
  if (gastos.itens.length === 0) semDados('Nada pago ou previsto neste período.')
  else {
    tabela(
      [gastos.agruparPor === 'imovel' ? 'Imóvel' : 'Categoria', 'Pago', 'Previsto'],
      gastos.itens.map((i) => [i.nome, reais(i.pagoCentavos), reais(i.previstoCentavos)]),
      ['Total', reais(gastos.totalPagoCentavos), reais(gastos.totalPrevistoCentavos)],
    )
    nota('Pago: contas pagas no período. Previsto: contas que vencem no período e ainda não foram pagas.')
  }

  // Rodapé com a paginação.
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setTextColor(...CINZA).setFont('helvetica', 'normal').setFontSize(9)
    doc.text(`Página ${p} de ${paginas}`, largura - MARGEM, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
  }
  return doc
}

export const nomeDoPdf = ({ inicio, fim }: { inicio: string; fim: string }) => `relatorio-${inicio}-a-${fim}.pdf`

/** Gera e entrega o PDF (no computador baixa; no celular o navegador oferece abrir ou salvar). */
export async function baixarRelatorioPdf(dados: DadosRelatorioPdf) {
  const doc = await montarRelatorioPdf(dados)
  salvarNoAparelho(doc.output('blob'), nomeDoPdf(dados.periodo))
}
