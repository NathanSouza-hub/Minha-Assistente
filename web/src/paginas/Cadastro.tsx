import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Campo } from '@/components/Campo'
import { LayoutVisitante } from '@/components/layout/LayoutVisitante'
import { useSessao } from '@/app/useSessao'
import { useSituacaoCadastro } from '@/consultas/auth'
import { api } from '@/lib/api'
import { aplicarErroApi } from '@/lib/formulario'
import { esquemaCadastro, type DadosCadastro } from '@/lib/esquemas/auth'
import type { Sessao } from '@/lib/tipos'

export function Cadastro() {
  const { entrar } = useSessao()
  const situacao = useSituacaoCadastro()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosCadastro>({
    resolver: zodResolver(esquemaCadastro),
    defaultValues: { nome: '', email: '', senha: '', confirmacao: '' },
  })

  const cadastro = useMutation({
    mutationFn: ({ nome, email, senha }: DadosCadastro) =>
      api<Sessao>('/auth/cadastro', { method: 'POST', corpo: { nome, email, senha } }),
    meta: { semAviso: true },
    // A conta nova já vem com a sessão: entra direto. O redirecionamento fica com RotaVisitante.
    onSuccess: (sessao) => {
      entrar(sessao)
      toast.success('Conta criada! Você já está dentro.')
    },
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
      {situacao.data?.aberto === false ? (
        <p role="status" className="text-lg">
          O cadastro de contas novas está fechado. Peça a quem cuida do app para criar a sua conta: você recebe
          uma senha para entrar e depois troca por uma sua.
        </p>
      ) : (
        <form noValidate onSubmit={handleSubmit((dados) => cadastro.mutate(dados))} className="flex flex-col gap-5">
          <Campo rotulo="Nome" autoComplete="name" erro={errors.nome?.message} {...register('nome')} />
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
            autoComplete="new-password"
            dica="Mínimo de 8 caracteres."
            erro={errors.senha?.message}
            {...register('senha')}
          />
          <Campo
            rotulo="Confirmar senha"
            type="password"
            autoComplete="new-password"
            erro={errors.confirmacao?.message}
            {...register('confirmacao')}
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
      )}
    </LayoutVisitante>
  )
}
