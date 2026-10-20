import { BellIcon, CaretRightIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { Conta } from '@/components/Conta'

/** /configuracoes: notificações e a conta (trocar senha, sair). As áreas ficam no menu principal. */
export function Configuracoes() {
  return (
    <Pagina titulo="Configurações">
      <div className="flex flex-col gap-8">
        <Link
          to="/notificacoes"
          className="flex min-h-16 items-center gap-4 rounded-2xl bg-folha px-4 text-lg font-semibold shadow-folha hover:bg-suave/60"
        >
          <span className="selo-area size-11" aria-hidden>
            <BellIcon className="size-6" weight="fill" />
          </span>
          <span className="flex flex-1 flex-col">
            Notificações
            <span className="text-base font-normal text-muted-foreground">Avisos no aparelho e resumo da manhã</span>
          </span>
          <CaretRightIcon weight="bold" className="size-6 text-muted-foreground" aria-hidden />
        </Link>
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Sua conta</h2>
          <Conta className="rounded-2xl bg-folha p-4 shadow-folha" />
        </section>
      </div>
    </Pagina>
  )
}
