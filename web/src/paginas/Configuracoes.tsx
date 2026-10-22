import { Pagina } from '@/components/layout/Pagina'
import { Conta } from '@/components/Conta'

/** /configuracoes: a conta (trocar senha, sair); as notificações ficam na aba ao lado. As áreas ficam no menu principal. */
export function Configuracoes() {
  return (
    <Pagina titulo="Configurações">
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="text-secao font-bold">Sua conta</h2>
          <Conta className="superficie p-4 sm:max-w-xl" />
        </section>
      </div>
    </Pagina>
  )
}
