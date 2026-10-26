import { salvarNoAparelho } from '@/lib/arquivos'
import { agruparPorCategoria } from '@/lib/compras'
import { agora } from '@/lib/datas'
import type { ItemCompra } from '@/lib/tipos'

export type DadosListaComprasPdf = {
  titulo: string
  /** Os itens escolhidos, na ordem da tela; os comprados saem com o quadradinho marcado. */
  itens: Pick<ItemCompra, 'nome' | 'categoria' | 'quantidade' | 'comprado'>[]
}

// Cores da identidade (src/index.css): azul da marca, texto secundário e linhas.
const AZUL: [number, number, number] = [31, 79, 209]
const GRAFITE: [number, number, number] = [30, 35, 45]
const CINZA: [number, number, number] = [90, 100, 120]
const LINHA: [number, number, number] = [215, 220, 230]
const MARGEM = 18
const ALTURA_ITEM = 9

/**
 * Lista de compras para imprimir ou mandar a alguém: por categoria, um quadradinho por item para
 * riscar na loja e a quantidade à direita. O jsPDF só é baixado quando a pessoa pede o PDF.
 */
export async function montarListaComprasPdf({ titulo, itens }: DadosListaComprasPdf) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const largura = doc.internal.pageSize.getWidth()
  const altura = doc.internal.pageSize.getHeight()

  doc.setTextColor(...AZUL).setFont('helvetica', 'bold').setFontSize(20)
  doc.text(titulo.trim() || 'Lista de compras', MARGEM, 22, { maxWidth: largura - 2 * MARGEM })
  doc.setTextColor(...CINZA).setFont('helvetica', 'normal').setFontSize(10)
  const total = itens.length === 1 ? '1 item' : `${itens.length} itens`
  doc.text(`${agora().toFormat('dd/MM/yyyy')} · ${total}`, MARGEM, 29)
  let y = 42

  // Quebra de página antes do que não cabe (o título da categoria não fica sozinho no pé).
  const garantir = (espaco: number) => {
    if (y + espaco <= altura - 18) return
    doc.addPage()
    y = 20
  }

  const grupos = agruparPorCategoria(itens)
  const soUmSemCategoria = grupos.length === 1 && grupos[0].chave === ''
  for (const grupo of grupos) {
    if (!soUmSemCategoria) {
      garantir(8 + ALTURA_ITEM)
      doc.setTextColor(...AZUL).setFont('helvetica', 'bold').setFontSize(11)
      doc.text(grupo.titulo.toLocaleUpperCase('pt-BR'), MARGEM, y)
      y += 4
    }
    for (const item of grupo.itens) {
      garantir(ALTURA_ITEM)
      const meio = y + ALTURA_ITEM / 2
      // Quadradinho para riscar; o item já comprado sai marcado e com o nome em cinza.
      doc.setDrawColor(...GRAFITE).setLineWidth(0.4)
      doc.rect(MARGEM, meio - 2.5, 5, 5)
      if (item.comprado) {
        doc.setLineWidth(0.6)
        doc.lines(
          [
            [1.3, 1.5],
            [2.4, -3.2],
          ],
          MARGEM + 1,
          meio + 0.1,
        )
      }
      doc.setTextColor(...(item.comprado ? CINZA : GRAFITE)).setFont('helvetica', 'normal').setFontSize(12)
      const larguraQuantidade = item.quantidade ? doc.getTextWidth(item.quantidade) + 6 : 0
      const nome = doc.splitTextToSize(item.nome, largura - 2 * MARGEM - 9 - larguraQuantidade)[0] as string
      doc.text(nome, MARGEM + 9, meio + 1.5)
      if (item.quantidade) {
        doc.setTextColor(...CINZA)
        doc.text(item.quantidade, largura - MARGEM, meio + 1.5, { align: 'right' })
      }
      doc.setDrawColor(...LINHA).setLineWidth(0.2)
      doc.line(MARGEM, y + ALTURA_ITEM, largura - MARGEM, y + ALTURA_ITEM)
      y += ALTURA_ITEM
    }
    y += 8
  }

  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setTextColor(...CINZA).setFont('helvetica', 'normal').setFontSize(9)
    doc.text('Minha Assistente', MARGEM, altura - 8)
    if (paginas > 1) doc.text(`Página ${p} de ${paginas}`, largura - MARGEM, altura - 8, { align: 'right' })
  }
  return doc
}

export const nomeDoPdfCompras = () => `lista-de-compras-${agora().toISODate()}.pdf`

/** Gera e entrega o PDF (no computador baixa; no celular o navegador oferece abrir ou salvar). */
export async function baixarListaComprasPdf(dados: DadosListaComprasPdf) {
  const doc = await montarListaComprasPdf(dados)
  salvarNoAparelho(doc.output('blob'), nomeDoPdfCompras())
}
