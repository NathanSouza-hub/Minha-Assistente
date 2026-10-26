import { useState } from 'react'
import { FilePdfIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Campo } from '@/components/Campo'
import { Opcoes } from '@/components/Opcoes'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { agruparPorCategoria } from '@/lib/compras'
import { baixarListaComprasPdf } from '@/lib/comprasPdf'
import type { ItemCompra } from '@/lib/tipos'

type Incluir = 'pendentes' | 'tudo'

/**
 * "PDF" no cabeçalho de Compras: antes de gerar, a pessoa ajusta o título, escolhe se entram só os
 * itens a comprar ou também os comprados e desmarca o que não quer no papel. Tudo volta ao padrão
 * a cada vez que a folha abre; nada disso muda a lista.
 */
export function GerarPdfCompras({ itens }: { itens: ItemCompra[] }) {
  const [aberto, setAberto] = useState(false)
  const [titulo, setTitulo] = useState('Lista de compras')
  const [incluir, setIncluir] = useState<Incluir>('pendentes')
  const [fora, setFora] = useState<Set<string>>(new Set())
  const [gerando, setGerando] = useState(false)

  const temPendentes = itens.some((i) => !i.comprado)
  const visiveis = incluir === 'tudo' ? itens : itens.filter((i) => !i.comprado)
  const escolhidos = visiveis.filter((i) => !fora.has(i.id))

  function abrir(abrindo: boolean) {
    if (abrindo) {
      setTitulo('Lista de compras')
      setIncluir(temPendentes ? 'pendentes' : 'tudo')
      setFora(new Set())
    }
    setAberto(abrindo)
  }

  function alternar(id: string) {
    setFora((atual) => {
      const novo = new Set(atual)
      if (!novo.delete(id)) novo.add(id)
      return novo
    })
  }

  async function gerar() {
    setGerando(true)
    try {
      await baixarListaComprasPdf({ titulo, itens: escolhidos })
      setAberto(false)
    } catch {
      toast.error('Não foi possível gerar o PDF. Tente de novo.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={abrir}>
      <SheetTrigger asChild>
        <Button variant="secondary">
          <FilePdfIcon weight="bold" aria-hidden />
          PDF
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-h-[90dvh] max-w-xl overflow-y-auto rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-base"
      >
        <SheetTitle className="text-secao font-bold">Gerar PDF da lista</SheetTitle>
        <SheetDescription className="text-muted-foreground">
          Ajuste o que vai para o papel. A lista do app não muda.
        </SheetDescription>

        <Campo rotulo="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoComplete="off" />
        {temPendentes && itens.some((i) => i.comprado) && (
          <Opcoes<Incluir>
            rotulo="O que entra"
            formato="segmentos"
            valor={incluir}
            aoMudar={setIncluir}
            opcoes={[
              { valor: 'pendentes', rotulo: 'A comprar' },
              { valor: 'tudo', rotulo: 'Tudo' },
            ]}
          />
        )}

        <div className="flex flex-col gap-3">
          {agruparPorCategoria(visiveis).map((grupo) => (
            <fieldset key={grupo.chave} className="flex flex-col">
              <legend className="area-compras mb-1 text-[0.8rem] font-bold tracking-[0.08em] text-area uppercase">
                {grupo.titulo}
              </legend>
              {grupo.itens.map((i) => (
                <label key={i.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 hover:bg-suave/60">
                  <input
                    type="checkbox"
                    checked={!fora.has(i.id)}
                    onChange={() => alternar(i.id)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className={i.comprado ? 'text-muted-foreground' : undefined}>{i.nome}</span>
                  {i.quantidade && <span className="ml-auto text-muted-foreground">{i.quantidade}</span>}
                </label>
              ))}
            </fieldset>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <SheetClose asChild>
            <Button variant="outline" size="lg">
              Cancelar
            </Button>
          </SheetClose>
          <Button size="lg" onClick={gerar} disabled={gerando || escolhidos.length === 0}>
            <FilePdfIcon weight="bold" aria-hidden />
            {gerando ? 'Gerando…' : escolhidos.length === 0 ? 'Escolha ao menos 1 item' : 'Baixar PDF'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
