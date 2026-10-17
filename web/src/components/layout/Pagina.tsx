import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { areaDaRota, type Area } from '@/app/navegacao'
import { cn } from '@/lib/utils'

type Props = {
  titulo: string
  /** Substitui o título visível (o título da aba continua sendo `titulo`). */
  cabecalho?: ReactNode
  acoes?: ReactNode
  /** Tela de tabela (Contas): usa mais da largura do computador. */
  larga?: boolean
  /** Cor da tela; sem ela, vem da rota (`areaDaRota`). */
  area?: Area
  children: ReactNode
}

/**
 * Moldura de toda tela: cabeçalho na "capa" petróleo (por trás da barra de status do celular),
 * a fita fina na cor da área e o conteúdo direto no papel creme. Dentro do cabeçalho as cores
 * se invertem (`.capa`), então links `text-primary` e botões padrão continuam legíveis.
 */
export function Pagina({ titulo, cabecalho, acoes, larga, area, children }: Props) {
  const { pathname } = useLocation()
  const areaDaTela = area ?? areaDaRota(pathname)

  useEffect(() => {
    document.title = `${titulo} · Minha Assistente`
  }, [titulo])

  const largura = larga ? 'max-w-6xl' : 'max-w-3xl'

  return (
    <div className={`area-${areaDaTela}`}>
      <header className="capa pt-[env(safe-area-inset-top)]">
        <div
          className={cn(
            'mx-auto flex w-full flex-wrap items-end justify-between gap-x-4 gap-y-3 px-4 pt-5 pb-6 md:px-8 md:pt-9 md:pb-8',
            largura,
          )}
        >
          {cabecalho ?? <h1 className="text-[1.75rem] leading-tight font-[750] tracking-[-0.01em]">{titulo}</h1>}
          {acoes}
        </div>
      </header>
      <div aria-hidden className="h-1.5 bg-area" />
      <div className={cn('mx-auto w-full px-4 pt-6 pb-8 md:px-8 md:pt-8', largura)}>{children}</div>
    </div>
  )
}
