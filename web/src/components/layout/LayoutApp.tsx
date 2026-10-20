import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import { Conta } from '@/components/Conta'
import { SECOES, SECOES_DA_BARRA, secaoDaTela, type Secao } from '@/app/navegacao'

export function LayoutApp() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-3"
      >
        Ir para o conteúdo
      </a>
      <BarraLateral />
      {/* Espaço embaixo para a barra de navegação fixa do celular não cobrir o conteúdo. */}
      <main id="conteudo" className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
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
 * Computador: as 6 áreas na barra azul; a área aberta mostra embaixo as telas dela, com a atual
 * marcada.
 */
function BarraLateral() {
  const { secao: atual, item: itemAtual } = useSecaoAtual()
  return (
    <aside className="capa sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto px-3 py-6 md:flex">
      <p className="flex items-center gap-3 px-3 text-xl font-bold">
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
                  'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-semibold text-azul-claro hover:bg-azul-profundo/60 hover:text-folha',
                  aberta && 'bg-azul-profundo text-folha',
                )}
              >
                {aberta && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-hoje" />}
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
                          'flex min-h-10 items-center rounded-lg px-3 text-base text-azul-claro hover:bg-azul-profundo/60 hover:text-folha',
                          item === itemAtual && 'bg-azul-profundo/70 font-semibold text-folha',
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

/** Celular: barra branca presa embaixo com as 5 áreas de uso; a aberta ganha o ícone cheio e a fita azul. */
function BarraInferior() {
  const { secao: atual } = useSecaoAtual()
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 bg-folha pb-[env(safe-area-inset-bottom)] shadow-barra md:hidden"
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
    <li className={`area-${secao.area}`}>
      <Link
        to={secao.rota}
        aria-current={ativa ? 'page' : undefined}
        className={cn(
          'relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 px-0.5 text-[0.72rem] leading-tight font-semibold tracking-tight text-muted-foreground min-[400px]:text-[0.8rem] min-[400px]:tracking-normal',
          ativa && 'text-foreground',
        )}
      >
        {ativa && <span aria-hidden className="absolute top-0 h-1 w-10 rounded-b-full bg-primary" />}
        <span
          className={cn(
            'grid h-8 w-14 place-items-center rounded-full transition-colors',
            ativa && 'bg-area-fundo text-area',
          )}
        >
          <Icone className="size-7" weight={ativa ? 'fill' : 'regular'} aria-hidden />
        </span>
        {secao.rotuloCurto ?? secao.rotulo}
      </Link>
    </li>
  )
}
