import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Button } from '@/components/ui/button'
import { useSessao } from '@/app/useSessao'
import { api } from '@/lib/api'
import { esquemaTrocaSenha, type DadosTrocaSenha } from '@/lib/esquemas/auth'
import { aplicarErroApi } from '@/lib/formulario'
import type { Sessao } from '@/lib/tipos'

/** /conta/senha: troca a senha; os outros aparelhos são desconectados pelo servidor. */
export function TrocarSenha() {
  const navegar = useNavigate()
  const { entrar } = useSessao()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosTrocaSenha>({
    resolver: zodResolver(esquemaTrocaSenha),
    defaultValues: { senhaAtual: '', novaSenha: '', confirmacao: '' },
  })

  const trocar = useMutation({
    mutationFn: ({ senhaAtual, novaSenha }: DadosTrocaSenha) =>
      api<Sessao>('/auth/senha', { method: 'PUT', corpo: { senhaAtual, novaSenha } }),
    meta: { semAviso: true },
  })

  async function enviar(dados: DadosTrocaSenha) {
    try {
      // O token antigo deixa de valer: guarda o novo para continuar conectado neste aparelho.
      entrar(await trocar.mutateAsync(dados))
      toast.success('Senha trocada. Os outros aparelhos precisam entrar de novo.')
      navegar('/mais')
    } catch (erro) {
      aplicarErroApi(erro, setError, { porCodigo: { SENHA_INCORRETA: 'senhaAtual' } })
    }
  }

  return (
    <Pagina
      titulo="Trocar senha"
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to="/mais"
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeftIcon weight="bold" className="size-5" aria-hidden />
            Mais
          </Link>
          <h1 className="text-3xl leading-tight font-bold">Trocar senha</h1>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex max-w-md flex-col gap-6">
        <Campo
          rotulo="Senha atual"
          type="password"
          autoComplete="current-password"
          erro={errors.senhaAtual?.message}
          {...register('senhaAtual')}
        />
        <Campo
          rotulo="Nova senha"
          type="password"
          autoComplete="new-password"
          dica="Pelo menos 8 caracteres."
          erro={errors.novaSenha?.message}
          {...register('novaSenha')}
        />
        <Campo
          rotulo="Repita a nova senha"
          type="password"
          autoComplete="new-password"
          erro={errors.confirmacao?.message}
          {...register('confirmacao')}
        />
        <p className="text-base text-muted-foreground">
          Por segurança, os outros celulares e computadores em que você entrou serão desconectados e
          deixam de receber os lembretes até entrarem de novo.
        </p>

        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
          {isSubmitting ? 'Trocando…' : 'Trocar senha'}
        </Button>
      </form>
    </Pagina>
  )
}
