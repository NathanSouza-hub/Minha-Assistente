import { KeyIcon, SignOutIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSessao } from '@/app/useSessao'
import { cn } from '@/lib/utils'

/** Nome e e-mail da pessoa logada, com trocar senha e sair. */
export function Conta({ className }: { className?: string }) {
  const { usuario, sair } = useSessao()
  if (!usuario) return null

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold">{usuario.nome}</p>
        <p className="truncate text-base text-muted-foreground">{usuario.email}</p>
      </div>
      <Button asChild variant="outline" className="w-full justify-start">
        <Link to="/conta/senha">
          <KeyIcon aria-hidden />
          Trocar senha
        </Link>
      </Button>
      <Button variant="outline" onClick={sair} className="w-full justify-start">
        <SignOutIcon aria-hidden />
        Sair da conta
      </Button>
    </div>
  )
}
