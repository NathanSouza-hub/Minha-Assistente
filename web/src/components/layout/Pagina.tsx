import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { areaDaRota, secaoDaTela, type Area } from '@/app/navegacao'
import { cn } from '@/lib/utils'

type Props = {
  titulo: string
  /** Substitui o título visível (o título da aba continua sendo `titulo`). */
  cabecalho?: ReactNode
  /** Ação de criar ("+ Nova", `variant="secondary"`), sempre no canto direito do cabeçalho. */
  acoes?: ReactNode
  /** Tela de tabela (Contas): usa mais da largura do computador. */
  larga?: boolean
  /** Cor da tela; sem ela, vem da rota (`areaDaRota`). */
  area?: Area
  children: ReactNode
}

/**
 * Moldura de toda tela: cabeçalho leve direto no fundo (rótulo da área pequeno na cor dela, título
 * grande em grafite e a ação de criar à direita), as abas da área no celular e o conteúdo.
 */
export function Pagina({ titulo, cabecalho, acoes, larga, area, children }: Props) {
  const { pathname, search } = useLocation()
  const areaDaTela = area ?? areaDaRota(pathname)
  const { secao } = secaoDaTela(pathname, search)
  // O rótulo da área só aparece quando diz algo além do título.
  const rotulo = secao && secao.id !== 'inicio' && secao.rotulo !== titulo ? secao.rotulo : null

  useEffect(() => {
    document.title = `${titulo} · Minha Assistente`
  }, [titulo])

  const largura = larga ? 'max-w-6xl' : 'max-w-3xl'

  return (
    <div className={`area-${areaDaTela}`}>
      <header className="pt-[env(safe-area-inset-top)]">
        <div
          className={cn(
            'mx-auto flex w-full items-end justify-between gap-3 px-4 pt-5 pb-1 md:px-8 md:pt-9',
            largura,
          )}
        >
          {cabecalho ?? (
            <div className="min-w-0">
              {rotulo && <p className="text-apoio font-semibold text-area">{rotulo}</p>}
              <h1 className="text-[1.5rem] leading-tight font-bold tracking-[-0.02em] hyphens-auto min-[400px]:text-titulo">
                {titulo}
              </h1>
            </div>
          )}
          {/* A ação fica sempre ao lado do título; se faltar espaço, o título quebra. */}
          {acoes && <div className="shrink-0">{acoes}</div>}
        </div>
      </header>
      <MenuDaSecao larga={larga} />
      <div className={cn('mx-auto w-full px-4 pt-5 pb-8 md:px-8 md:pt-7', largura)}>{children}</div>
    </div>
  )
}

/** Rola o menu (não a página) até o item, se ele estiver cortado na borda. */
function mostrarNoMenu(item: HTMLAnchorElement | null) {
  const menu = item?.closest('ul')
  if (!item || !menu) return
  const li = item.parentElement as HTMLElement
  if (li.offsetLeft + li.offsetWidth > menu.clientWidth) menu.scrollLeft = li.offsetLeft - 16
}

/**
 * Celular: as telas da área (ex.: Finanças → Visão geral, Contas a pagar...) em abas de texto que
 * rolam para o lado, só nas telas de lista (num formulário, o "voltar" basta). No computador a barra
 * lateral já mostra essas telas.
 */
function MenuDaSecao({ larga }: { larga?: boolean }) {
  const { pathname, search } = useLocation()
  const { secao, item: atual, exato } = secaoDaTela(pathname, search)
  if (!secao || !exato || secao.itens.length < 2) return null
  return (
    <nav aria-label={`Telas de ${secao.rotulo}`} className="mt-2 border-b border-linha md:hidden">
      <ul className={cn('relative mx-auto flex gap-6 overflow-x-auto px-4 [scrollbar-width:none]', larga ? 'max-w-6xl' : 'max-w-3xl')}>
        {secao.itens.map((item) => (
          <li key={item.rota} className="shrink-0">
            <Link
              to={item.rota}
              aria-current={item === atual ? 'page' : undefined}
              // A tela atual fica à vista mesmo quando o menu rola para o lado (ex.: a última da lista).
              ref={item === atual ? mostrarNoMenu : undefined}
              className={cn(
                'flex min-h-11 items-center text-base font-medium whitespace-nowrap text-muted-foreground hover:text-foreground',
                item === atual && 'font-bold text-foreground shadow-[inset_0_-3px_0_var(--azul)]',
              )}
            >
              {item.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
