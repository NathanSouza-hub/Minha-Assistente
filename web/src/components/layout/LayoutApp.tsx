import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import { Conta } from '@/components/Conta'
import { SECOES, SECOES_DA_BARRA, secaoDaTela, type Secao } from '@/app/navegacao'

export function LayoutApp() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16.5rem_minmax(0,1fr)]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-3"
      >
        Ir para o conteúdo
      </a>
      <BarraLateral />
      {/* Espaço embaixo para a barra flutuante do celular não cobrir o conteúdo. */}
      <main id="conteudo" className="pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0">
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
 * Computador: as 6 áreas numa coluna no tom do fundo; a aberta vira uma pílula escura com o ícone em
 * âmbar e mostra embaixo as telas dela, com a atual marcada.
 */
function BarraLateral() {
  const { secao: atual, item: itemAtual } = useSecaoAtual()
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-7 overflow-y-auto bg-suave px-4 py-7 [scrollbar-width:thin] md:flex">
      <p className="flex items-center gap-3 px-2 font-heading text-lg font-bold tracking-[-0.02em]">
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
                  'flex min-h-12 items-center gap-3 rounded-full px-4 text-base font-semibold text-foreground hover:bg-folha/70',
                  aberta && 'bg-grafite font-bold text-folha hover:bg-grafite',
                )}
              >
                <Icone
                  className={cn('size-6 shrink-0', aberta && 'text-ambar')}
                  weight={aberta ? 'fill' : 'regular'}
                  aria-hidden
                />
                {secao.rotulo}
              </Link>
              {aberta && secao.itens.length > 1 && (
                <ul className="mt-1 mb-2 flex flex-col pl-11">
                  {secao.itens.map((item) => (
                    <li key={item.rota}>
                      <Link
                        to={item.rota}
                        aria-current={item === itemAtual ? 'page' : undefined}
                        className={cn(
                          'flex min-h-10 items-center rounded-lg px-2 text-base text-muted-foreground hover:text-foreground',
                          item === itemAtual && 'font-bold text-foreground',
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
      <Conta className="mt-auto border-t border-contorno/60 px-2 pt-5" />
    </aside>
  )
}

/**
 * Celular: uma pílula escura flutuando embaixo com as 5 áreas de uso. A aberta vira uma pílula âmbar
 * com o ícone e o nome; as outras mostram só o ícone (o nome vai no aria-label e no title).
 */
function BarraInferior() {
  const { secao: atual } = useSecaoAtual()
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 md:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-md items-center justify-between rounded-full bg-grafite px-2 shadow-[0_10px_30px_rgb(27_29_38/0.25)]">
        {SECOES_DA_BARRA.map((secao) => (
          <ItemBarra key={secao.id} secao={secao} ativa={secao.id === atual?.id} />
        ))}
      </ul>
    </nav>
  )
}

function ItemBarra({ secao, ativa }: { secao: Secao; ativa: boolean }) {
  const Icone = secao.icone
  const nome = secao.rotuloCurto ?? secao.rotulo
  return (
    <li className={cn('flex', ativa ? 'shrink-0' : 'flex-1 justify-center')}>
      <Link
        to={secao.rota}
        aria-current={ativa ? 'page' : undefined}
        title={nome}
        className={cn(
          'flex h-12 items-center justify-center gap-2 rounded-full text-[#b4b6c1] hover:text-folha',
          ativa ? 'bg-ambar px-4 font-bold text-grafite hover:text-grafite' : 'w-12',
        )}
      >
        <Icone className="size-6 shrink-0" weight={ativa ? 'fill' : 'regular'} aria-hidden />
        {/* Só a área atual mostra o nome; nas outras ele fica para leitores de tela. */}
        <span className={ativa ? 'text-[0.95rem]' : 'sr-only'}>{nome}</span>
      </Link>
    </li>
  )
}
