import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import { Conta } from '@/components/Conta'
import {
  itemMais,
  navegacaoConfiguracoes,
  navegacaoPrincipal,
  navegacaoSecundaria,
  type ItemNavegacao,
} from '@/app/navegacao'

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

function BarraLateral() {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r bg-card px-4 py-5 md:flex">
      <p className="px-3 text-xl font-bold text-primary">Minha Assistente</p>
      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {[...navegacaoPrincipal, ...navegacaoSecundaria].map((item) => (
          <LinkLateral key={item.rota} item={item} />
        ))}
      </nav>
      <nav aria-labelledby="titulo-config" className="flex flex-col gap-0.5">
        <h2 id="titulo-config" className="px-3 pb-1 text-base font-semibold text-muted-foreground">
          Configurações
        </h2>
        {navegacaoConfiguracoes.map((item) => (
          <LinkLateral key={item.rota} item={item} />
        ))}
      </nav>
      <Conta className="mt-auto border-t px-3 pt-4" />
    </aside>
  )
}

function LinkLateral({ item }: { item: ItemNavegacao }) {
  const Icone = item.icone
  return (
    <NavLink
      to={item.rota}
      end={item.rota === '/'}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-semibold text-foreground hover:bg-muted',
          isActive && 'bg-secondary text-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Fita açafrão, como o marcador de página de uma agenda. */}
          {isActive && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-hoje" />}
          <Icone className="size-6 shrink-0" aria-hidden />
          {item.rotulo}
        </>
      )}
    </NavLink>
  )
}

// No celular, as áreas secundárias são abertas pelo "Mais", que fica marcado nelas.
const rotasDoMais = [...navegacaoSecundaria, ...navegacaoConfiguracoes].map((item) => item.rota)

function BarraInferior() {
  const { pathname } = useLocation()
  const emAreaDoMais = rotasDoMais.some((rota) => pathname.startsWith(rota))
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {[...navegacaoPrincipal, itemMais].map((item) => {
          const Icone = item.icone
          const marcar = (isActive: boolean) => isActive || (item === itemMais && emAreaDoMais)
          return (
            <li key={item.rota}>
              <NavLink
                to={item.rota}
                end={item.rota === '/'}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 px-0.5 text-[0.72rem] leading-tight font-semibold tracking-tight min-[400px]:text-[0.8rem] min-[400px]:tracking-normal text-muted-foreground',
                    marcar(isActive) && 'text-primary',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {marcar(isActive) && (
                      <span aria-hidden className="absolute top-0 h-1 w-10 rounded-b-full bg-hoje" />
                    )}
                    <Icone className="size-7" strokeWidth={marcar(isActive) ? 2.4 : 1.8} aria-hidden />
                    {item.rotuloCurto ?? item.rotulo}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
