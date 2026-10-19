import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Campo } from '@/components/Campo'
import { LayoutVisitante } from '@/components/layout/LayoutVisitante'
import { useSessao } from '@/app/useSessao'
import { useSituacaoCadastro } from '@/consultas/auth'
import { api } from '@/lib/api'
import { aplicarErroApi } from '@/lib/formulario'
import { esquemaLogin, type DadosLogin } from '@/lib/esquemas/auth'
import type { Sessao } from '@/lib/tipos'

export function Entrar() {
  const { entrar } = useSessao()
  const cadastro = useSituacaoCadastro()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosLogin>({ resolver: zodResolver(esquemaLogin), defaultValues: { email: '', senha: '' } })

  const login = useMutation({
    mutationFn: (dados: DadosLogin) => api<Sessao>('/auth/login', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    // O redirecionamento para o app fica com RotaVisitante.
    onSuccess: entrar,
    onError: (erro) => aplicarErroApi(erro, setError),
  })

  return (
    <LayoutVisitante
      titulo="Entrar"
      subtitulo="Use o e-mail e a senha da sua conta."
      rodape={
        cadastro.data?.aberto ? (
          <p>
            Ainda não tem conta?{' '}
            <Link to="/cadastro" className="font-semibold text-primary underline underline-offset-4">
              Criar conta
            </Link>
          </p>
        ) : (
          // Fechado (ou ainda carregando): sem o link, que só levaria a um erro.
          cadastro.data && <p>Ainda não tem conta? Peça a quem cuida do app para criar a sua.</p>
        )
      }
    >
      <form noValidate onSubmit={handleSubmit((dados) => login.mutate(dados))} className="flex flex-col gap-5">
        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          erro={errors.email?.message}
          {...register('email')}
        />
        <Campo
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          erro={errors.senha?.message}
          {...register('senha')}
        />
        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" disabled={login.isPending} className="mt-2 w-full">
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </LayoutVisitante>
  )
}
