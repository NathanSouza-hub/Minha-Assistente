import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { navegacaoConfiguracoes, navegacaoSecundaria, type ItemNavegacao } from '@/app/navegacao'

function Lista({ itens }: { itens: ItemNavegacao[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {itens.map(({ rota, rotulo, icone: Icone }) => (
        <li key={rota}>
          <Link to={rota} className="flex min-h-16 items-center gap-4 px-4 text-lg font-semibold hover:bg-muted">
            <Icone className="size-7 text-primary" aria-hidden />
            <span className="flex-1">{rotulo}</span>
            <ChevronRight className="size-6 text-muted-foreground" aria-hidden />
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
      </div>
    </Pagina>
  )
}
