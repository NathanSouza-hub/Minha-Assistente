import { useState, type ReactNode } from 'react'
import { CaretRightIcon, DotsThreeIcon, type Icon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { MarcaEstado, type EstadoMarca } from '@/components/Estado'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/**
 * As linhas das listas (doc "Estrutura das telas" de docs/identidade-visual.md): sempre dentro de
 * uma `<Lista>` (superfície branca com fio entre as linhas). Mesmo desenho do Início em todas as áreas.
 */
export function Lista({ rotulo, className, children }: { rotulo?: string; className?: string; children: ReactNode }) {
  return (
    <ul aria-label={rotulo} className={cn('superficie flex flex-col divide-y divide-linha overflow-hidden', className)}>
      {children}
    </ul>
  )
}

type Marcar = {
  /** Nome acessível do círculo ("Tomei Losartana", "Desfazer: ..."). */
  rotulo: string
  aoMarcar: () => void
  /** Estado de "marcado" para leitores de tela. */
  marcado: boolean
  desabilitado?: boolean
  /** "checkbox" quando o círculo só liga/desliga (lista de compras, compromissos). */
  papel?: 'checkbox'
}

/**
 * Linha com o círculo de concluir à esquerda (alvo de 48px), título e apoio no meio (com `para`, o
 * meio abre o item) e, à direita, `fim` (o ⋯ de `MenuLinha` ou um atalho). Sem `marcar`, o círculo
 * só mostra o estado (ex.: dia que ainda não chegou). `meioMarca`: tocar no texto também marca
 * (lista de compras, usada com uma mão; o leitor de tela usa o círculo).
 */
export function LinhaMarcavel({
  estado,
  marcar,
  titulo,
  valor,
  apoio,
  para,
  fim,
  meioMarca,
  className,
}: {
  estado: EstadoMarca
  marcar?: Marcar
  titulo: ReactNode
  /** Valor na linha do título, à direita (contas). */
  valor?: ReactNode
  apoio?: ReactNode
  para?: string
  fim?: ReactNode
  meioMarca?: boolean
  className?: string
}) {
  const encerrada = estado === 'feito' || estado === 'nao_feito'
  const meio = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            'min-w-0 text-base leading-snug font-semibold break-words',
            encerrada && 'font-medium text-muted-foreground',
            estado === 'feito' && 'line-through',
          )}
        >
          {titulo}
        </p>
        {valor && <span className="shrink-0 text-right font-bold tabular-nums">{valor}</span>}
      </div>
      {apoio && <div className="mt-0.5 text-apoio leading-snug text-muted-foreground">{apoio}</div>}
    </>
  )
  return (
    <li className={cn('flex items-center gap-1 py-1.5 pr-1 pl-1', className)}>
      {marcar ? (
        <button
          type="button"
          role={marcar.papel}
          onClick={marcar.aoMarcar}
          disabled={marcar.desabilitado}
          aria-label={marcar.rotulo}
          {...(marcar.papel === 'checkbox' ? { 'aria-checked': marcar.marcado } : { 'aria-pressed': marcar.marcado })}
          className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-suave disabled:opacity-50"
        >
          <MarcaEstado estado={estado} />
        </button>
      ) : (
        <span className="grid size-12 shrink-0 place-items-center opacity-50">
          <MarcaEstado estado={estado} />
        </span>
      )}
      {para ? (
        <Link to={para} className="min-w-0 flex-1 rounded-lg py-1.5 hover:bg-suave/50">
          {meio}
        </Link>
      ) : meioMarca && marcar ? (
        // O círculo ao lado já é o controle acessível; aqui é só a área de toque maior.
        <div onClick={marcar.aoMarcar} className="min-w-0 flex-1 cursor-pointer rounded-lg py-1.5 select-none">
          {meio}
        </div>
      ) : (
        <div className="min-w-0 flex-1 py-1.5">{meio}</div>
      )}
      {fim}
    </li>
  )
}

export type AcaoLinha = { rotulo: string; icone: Icon; aoEscolher?: () => void; para?: string; perigo?: boolean }

/** O ⋯ da linha: abre por baixo as outras ações do item (Não fiz, Voltar para pendente, Abrir...). */
export function MenuLinha({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes: AcaoLinha[] }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`Mais opções: ${titulo}`}
        className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-suave hover:text-foreground"
      >
        <DotsThreeIcon weight="bold" className="size-6" aria-hidden />
      </button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="mx-auto max-w-xl rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="text-secao font-bold">{titulo}</SheetTitle>
          <SheetDescription className={cn('-mt-3 text-base text-muted-foreground', !descricao && 'sr-only')}>
            {descricao || 'Escolha uma ação.'}
          </SheetDescription>
          <div className="flex flex-col gap-2">
            {acoes.map(({ rotulo, icone: Icone, aoEscolher, para, perigo }) =>
              para ? (
                <Button key={rotulo} asChild variant="outline" size="lg" className="justify-start">
                  <Link to={para}>
                    <Icone weight="bold" aria-hidden />
                    {rotulo}
                  </Link>
                </Button>
              ) : (
                <Button
                  key={rotulo}
                  variant="outline"
                  size="lg"
                  className={cn('justify-start', perigo && 'text-atraso')}
                  onClick={() => {
                    setAberto(false)
                    aoEscolher?.()
                  }}
                >
                  <Icone weight="bold" aria-hidden />
                  {rotulo}
                </Button>
              ),
            )}
            <Button variant="ghost" size="lg" onClick={() => setAberto(false)}>
              Fechar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Linha que só abre o item (cadastros: Meus remédios, Todos os compromissos...), com a seta à direita. */
export function LinhaLink({ para, titulo, apoio, fim, apagada }: { para: string; titulo: ReactNode; apoio?: ReactNode; fim?: ReactNode; apagada?: boolean }) {
  return (
    <li>
      <Link to={para} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-suave/50">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('text-base leading-snug font-semibold break-words', apagada && 'text-muted-foreground')}>
            {titulo}
          </span>
          {apoio && <span className="text-apoio leading-snug text-muted-foreground">{apoio}</span>}
        </span>
        {fim}
        <CaretRightIcon weight="bold" className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  )
}
