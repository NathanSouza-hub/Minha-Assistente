import { CaretRightIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { Conta } from '@/components/Conta'
import { navegacaoConfiguracoes, navegacaoSecundaria, type ItemNavegacao } from '@/app/navegacao'

function Lista({ itens }: { itens: ItemNavegacao[] }) {
  return (
    <ul className="flex flex-col divide-y divide-linha">
      {itens.map(({ rota, rotulo, icone: Icone, area }) => (
        <li key={rota} className={`area-${area} py-1`}>
          <Link
            to={rota}
            className="-mx-2 flex min-h-16 items-center gap-4 rounded-lg px-2 text-lg font-semibold hover:bg-areia/70"
          >
            <span className="selo-area size-11" aria-hidden>
              <Icone className="size-6" weight="fill" />
            </span>
            <span className="flex-1">{rotulo}</span>
            <CaretRightIcon weight="bold" className="size-6 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function Mais() {
  return (
    <Pagina titulo="Mais">
      <div className="flex flex-col gap-8">
        <Lista itens={navegacaoSecundaria} />
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Configurações</h2>
          <Lista itens={navegacaoConfiguracoes} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Sua conta</h2>
          <Conta className="rounded-2xl bg-folha p-4 shadow-folha" />
        </section>
      </div>
    </Pagina>
  )
}
