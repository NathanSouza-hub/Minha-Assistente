import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Campo } from '@/components/Campo'
import { LayoutVisitante } from '@/components/layout/LayoutVisitante'
import { useSessao } from '@/app/sessao'
import { api } from '@/lib/api'
import { aplicarErroApi } from '@/lib/formulario'
import { esquemaCadastro, type DadosCadastro } from '@/lib/esquemas/auth'
import type { Sessao } from '@/lib/tipos'

export function Cadastro() {
  const { entrar } = useSessao()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosCadastro>({
    resolver: zodResolver(esquemaCadastro),
    defaultValues: { nome: '', email: '', senha: '' },
  })

  const cadastro = useMutation({
    mutationFn: (dados: DadosCadastro) => api<Sessao>('/auth/cadastro', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    // O redirecionamento para o app fica com RotaVisitante.
    onSuccess: entrar,
    onError: (erro) => aplicarErroApi(erro, setError, { porCodigo: { EMAIL_EM_USO: 'email' } }),
  })

  return (
    <LayoutVisitante
      titulo="Criar conta"
      subtitulo="Leva menos de um minuto."
      rodape={
        <p>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-semibold text-primary underline underline-offset-4">
            Entrar
          </Link>
        </p>
      }
    >
      <form noValidate onSubmit={handleSubmit((dados) => cadastro.mutate(dados))} className="flex flex-col gap-5">
        <Campo rotulo="Seu nome" autoComplete="name" erro={errors.nome?.message} {...register('nome')} />
        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          erro={errors.email?.message}
          {...register('email')}
        />
        <Campo
          rotulo="Crie uma senha"
          type="password"
          autoComplete="new-password"
          dica="Pelo menos 8 caracteres."
          erro={errors.senha?.message}
          {...register('senha')}
        />
        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" disabled={cadastro.isPending} className="mt-2 w-full">
          {cadastro.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
    </LayoutVisitante>
  )
}
