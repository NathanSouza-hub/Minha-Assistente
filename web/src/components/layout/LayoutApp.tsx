import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import { Conta } from '@/components/Conta'
import { SECOES, SECOES_DA_BARRA, secaoDaTela, type Secao } from '@/app/navegacao'

export function LayoutApp() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-3"
      >
        Ir para o conteúdo
      </a>
      <BarraLateral />
      {/* Espaço embaixo para a barra de navegação fixa do celular não cobrir o conteúdo. */}
      <main id="conteudo" className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>
      <BarraInferior />
      {/* Tela nova abre no topo; voltar devolve a posição. Chave pelo caminho: trocar mês ou
          filtro (só muda a query) não faz a lista pular para o topo. */}
      <ScrollRestoration getKey={(local) => local.pathname} />
    </div>
  )
}

/** Seção da tela aberta (a Início só no caminho exato). */
function useSecaoAtual() {
  const { pathname, search } = useLocation()
  return secaoDaTela(pathname, search)
}

/**
 * Computador: as 6 áreas numa barra branca; a área aberta mostra embaixo as telas dela, com a atual
 * marcada.
 */
function BarraLateral() {
  const { secao: atual, item: itemAtual } = useSecaoAtual()
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r [scrollbar-width:thin] border-linha bg-folha px-3 py-6 md:flex">
      <p className="flex items-center gap-3 px-3 text-lg font-bold tracking-[-0.01em]">
        <img src="/favicon.svg" alt="" className="size-9" />
        Minha Assistente
      </p>
      <nav aria-label="Principal" className="flex flex-col gap-1">
        {SECOES.map((secao) => {
          const aberta = secao.id === atual?.id
          const Icone = secao.icone
          return (
            <div key={secao.id} className="flex flex-col gap-0.5">
              <Link
                to={secao.rota}
                aria-current={aberta && !itemAtual ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-medium text-muted-foreground hover:bg-suave hover:text-foreground',
                  aberta && 'bg-azul-fundo font-semibold text-azul-profundo hover:bg-azul-fundo hover:text-azul-profundo',
                )}
              >
                <Icone className="size-6 shrink-0" weight={aberta ? 'fill' : 'regular'} aria-hidden />
                {secao.rotulo}
              </Link>
              {aberta && secao.itens.length > 1 && (
                <ul className="mt-0.5 mb-2 flex flex-col gap-0.5 pl-9">
                  {secao.itens.map((item) => (
                    <li key={item.rota}>
                      <Link
                        to={item.rota}
                        aria-current={item === itemAtual ? 'page' : undefined}
                        className={cn(
                          'flex min-h-10 items-center rounded-lg px-3 text-base text-muted-foreground hover:bg-suave hover:text-foreground',
                          item === itemAtual && 'font-semibold text-azul-profundo',
                        )}
                      >
                        {item.rotulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </nav>
      <Conta className="mt-auto border-t px-3 pt-5" />
    </aside>
  )
}

/** Celular: barra branca presa embaixo com as 5 áreas de uso; a aberta fica azul, com o ícone cheio. */
function BarraInferior() {
  const { secao: atual } = useSecaoAtual()
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-linha bg-folha pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {SECOES_DA_BARRA.map((secao) => (
          <ItemBarra key={secao.id} secao={secao} ativa={secao.id === atual?.id} />
        ))}
      </ul>
    </nav>
  )
}

function ItemBarra({ secao, ativa }: { secao: Secao; ativa: boolean }) {
  const Icone = secao.icone
  return (
    <li>
      <Link
        to={secao.rota}
        aria-current={ativa ? 'page' : undefined}
        className={cn(
          'flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-[0.74rem] leading-tight font-medium text-muted-foreground min-[400px]:text-[0.8rem]',
          ativa && 'font-bold text-primary',
        )}
      >
        <Icone className="size-[1.6rem]" weight={ativa ? 'fill' : 'regular'} aria-hidden />
        {secao.rotuloCurto ?? secao.rotulo}
      </Link>
    </li>
  )
}
