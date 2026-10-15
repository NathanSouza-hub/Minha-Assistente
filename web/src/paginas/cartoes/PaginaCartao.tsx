import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCartoes, useExcluirCartao, useSalvarCartao } from '@/consultas/cartoes'
import { aplicarErroApi } from '@/lib/formulario'
import type { Cartao } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { CORES, FUNDOS, camposDaApiCartao, cartaoParaCorpo, esquemaCartao, valoresIniciaisCartao, type DadosCartao } from './formulario'

const LISTA = '/pagamentos?aba=cartoes'

/** /cartoes/novo e /cartoes/:id (o cartão vem da lista, como na aba Cartões). */
export function PaginaCartao() {
  const { id } = useParams()
  const consulta = useCartoes()
  const cartao = consulta.data?.find((c) => c.id === id)

  if (id && consulta.isPending) {
    return (
      <Pagina titulo="Editar cartão">
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20" />
          ))}
        </div>
      </Pagina>
    )
  }
  if (id && !cartao) {
    return (
      <Pagina titulo="Cartão não encontrado">
        <p className="mb-4 text-lg">Este cartão não existe mais ou foi excluído.</p>
        <Button asChild variant="outline">
          <Link to={LISTA}>Voltar para os cartões</Link>
        </Button>
      </Pagina>
    )
  }
  return <FormularioCartao key={id ?? 'novo'} cartao={cartao} />
}

function FormularioCartao({ cartao }: { cartao?: Cartao }) {
  const navegar = useNavigate()
  const salvarCartao = useSalvarCartao()
  const excluir = useExcluirCartao()
  const titulo = cartao ? 'Editar cartão' : 'Novo cartão'

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DadosCartao>({
    resolver: zodResolver(esquemaCartao),
    defaultValues: valoresIniciaisCartao(cartao),
  })

  useEffect(() => {
    if (!cartao) setFocus('nome')
  }, [cartao, setFocus])

  async function salvar(dados: DadosCartao) {
    try {
      const salvo = await salvarCartao.mutateAsync({ id: cartao?.id, dados: cartaoParaCorpo(dados) })
      toast.success(cartao ? 'Cartão salvo.' : 'Cartão criado.')
      navegar(`${LISTA}&cartao=${salvo.id}`)
    } catch (erro) {
      aplicarErroApi(erro, setError, { campos: camposDaApiCartao, porCodigo: { CARTAO_DUPLICADO: 'nome' } })
    }
  }

  // Navega antes: o cartão sai da lista em cache e esta tela deixaria de existir.
  function remover() {
    if (!cartao) return
    navegar(LISTA)
    excluir.mutate(cartao.id, { onSuccess: () => toast.success('Cartão excluído.') })
  }

  return (
    <Pagina
      titulo={titulo}
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to={cartao ? `${LISTA}&cartao=${cartao.id}` : LISTA}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Cartões
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit(salvar)} className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
          <Campo rotulo="Nome do cartão" placeholder="Ex.: Nubank" erro={errors.nome?.message} {...register('nome')} />
          <Campo
            rotulo="Final (opcional)"
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            dica="Os 4 últimos números."
            erro={errors.final?.message}
            {...register('final')}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-semibold">Cor</legend>
          <div className="flex flex-wrap gap-3">
            {CORES.map(({ valor, rotulo }) => (
              <label key={valor} className="flex cursor-pointer flex-col items-center gap-1 text-base">
                <input type="radio" value={valor} className="peer sr-only" {...register('cor')} />
                <span
                  aria-hidden
                  className={cn(
                    'size-12 rounded-xl bg-linear-to-br ring-offset-2 ring-offset-background peer-checked:ring-4 peer-checked:ring-hoje peer-focus-visible:ring-4 peer-focus-visible:ring-ring/50',
                    FUNDOS[valor],
                  )}
                />
                {rotulo}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo
            rotulo="Dia do fechamento"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            dica="Compras deste dia em diante vão para a fatura seguinte."
            erro={errors.diaFechamento?.message}
            {...register('diaFechamento')}
          />
          <Campo
            rotulo="Dia do vencimento"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            erro={errors.diaVencimento?.message}
            {...register('diaVencimento')}
          />
        </div>

        <Campo
          rotulo="Limite (opcional)"
          prefixo="R$"
          inputMode="decimal"
          placeholder="0,00"
          erro={errors.limite?.message}
          {...register('limite')}
        />

        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Salvando…' : cartao ? 'Salvar alterações' : 'Criar cartão'}
          </Button>
          {cartao && (
            <Confirmar
              gatilho={
                <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                  <Trash2 aria-hidden />
                  Excluir cartão
                </Button>
              }
              titulo="Excluir este cartão?"
              descricao={`${cartao.nome}, as compras dele e as faturas ainda não pagas serão apagados.`}
              confirmar="Excluir cartão"
              aoConfirmar={remover}
            />
          )}
        </div>
      </form>
    </Pagina>
  )
}
