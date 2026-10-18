import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckIcon, PencilSimpleIcon, PlusIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Progresso } from '@/components/Progresso'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCompras, useLimparComprados, useMarcarComprado, useSalvarItem } from '@/consultas/compras'
import { chaveCategoria } from '@/lib/compras'
import { aplicarErroApi } from '@/lib/formulario'
import type { ItemCompra } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { CamposExtras } from './CamposExtras'
import {
  descreverCompra,
  esquemaItem,
  paraCorpo,
  sugerirCategorias,
  valoresIniciais,
  type DadosItem,
} from './formulario'

export function Compras() {
  const consulta = useCompras()
  const itens = consulta.data ?? []
  const pendentes = itens.filter((i) => !i.comprado)
  const comprados = itens.filter((i) => i.comprado)

  return (
    <Pagina titulo="Compras">
      <div className="flex flex-col gap-8">
        <AdicionarItem categorias={sugerirCategorias(itens)} />

        {consulta.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Carregando a lista">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-16" />
            ))}
          </div>
        ) : consulta.isError ? (
          <EstadoVazio
            icone={ShoppingCartIcon}
            titulo="Não foi possível carregar a lista"
            acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
          >
            Verifique a internet e tente de novo.
          </EstadoVazio>
        ) : itens.length === 0 ? (
          <EstadoVazio icone={ShoppingCartIcon} titulo="A lista está vazia">
            Escreva acima o que falta comprar. No mercado, toque no item para marcar que já pegou.
          </EstadoVazio>
        ) : (
          <>
            <Progresso
              feitos={comprados.length}
              total={itens.length}
              texto={`${comprados.length} de ${itens.length} ${itens.length === 1 ? 'item comprado' : 'itens comprados'}`}
              textoCompleto="Tudo comprado."
            />
            {pendentes.length > 0 && <Pendentes itens={pendentes} />}
            {comprados.length > 0 && <Comprados itens={comprados} />}
          </>
        )}
      </div>
    </Pagina>
  )
}

function AdicionarItem({ categorias }: { categorias: string[] }) {
  const salvar = useSalvarItem()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting, isSubmitSuccessful, submitCount },
  } = useForm<DadosItem>({ resolver: zodResolver(esquemaItem), defaultValues: valoresIniciais() })

  // De volta ao campo para anotar o próximo item (depois de o envio terminar: antes disso o
  // formulário ainda está ocupado e o foco não fica).
  useEffect(() => {
    if (isSubmitSuccessful) setFocus('nome')
  }, [isSubmitSuccessful, submitCount, setFocus])

  async function enviar(dados: DadosItem) {
    try {
      const item = await salvar.mutateAsync({ dados: paraCorpo(dados) })
      toast.success(`${item.nome} adicionado à lista.`)
      // A categoria fica para o próximo item: quase sempre se anotam vários do mesmo lugar.
      reset(valoresIniciais(undefined, dados.categoria), { keepIsSubmitSuccessful: true })
    } catch (erro) {
      aplicarErroApi(erro, setError)
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(enviar)}
      aria-label="Adicionar item"
      className="flex flex-col gap-4 rounded-2xl bg-folha p-4 shadow-folha"
    >
      <Campo
        rotulo="O que falta comprar?"
        placeholder="Ex.: Leite"
        autoComplete="off"
        enterKeyHint="done"
        erro={errors.nome?.message}
        {...register('nome')}
      />
      <CamposExtras register={register} errors={errors} categorias={categorias} />
      {errors.root && (
        <p role="alert" className="font-semibold text-destructive">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
        <PlusIcon weight="bold" aria-hidden />
        {isSubmitting ? 'Adicionando…' : 'Adicionar à lista'}
      </Button>
    </form>
  )
}

/** Pendentes agrupados por categoria, na ordem da API (sem categoria no fim). */
function Pendentes({ itens }: { itens: ItemCompra[] }) {
  // Agrupa sem diferenciar maiúsculas e acentos; o título é o primeiro jeito como foi escrita.
  const grupos = new Map<string, { titulo: string; itens: ItemCompra[] }>()
  for (const item of itens) {
    const chave = item.categoria === null ? '' : chaveCategoria(item.categoria)
    const grupo = grupos.get(chave) ?? { titulo: item.categoria ?? 'Sem categoria', itens: [] }
    grupo.itens.push(item)
    grupos.set(chave, grupo)
  }
  const soUmSemCategoria = grupos.size === 1 && grupos.has('')

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">A comprar</h2>
      {[...grupos].map(([chave, { titulo, itens: doGrupo }]) => (
        <div key={chave} className="flex flex-col">
          {!soUmSemCategoria && <h3 className="font-semibold text-area">{titulo}</h3>}
          <ul className="flex flex-col divide-y divide-linha" aria-label={soUmSemCategoria ? 'A comprar' : titulo}>
            {doGrupo.map((i) => (
              <LinhaItem key={i.id} item={i} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function Comprados({ itens }: { itens: ItemCompra[] }) {
  const limpar = useLimparComprados()
  const n = itens.length

  function tirarDaLista() {
    limpar.mutate(
      itens.map((i) => i.id),
      { onSuccess: () => toast.success(n === 1 ? 'Item comprado tirado da lista.' : `${n} itens comprados tirados da lista.`) },
    )
  }

  return (
    <section className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Já comprados</h2>
        <Confirmar
          gatilho={
            <Button variant="outline" size="sm" disabled={limpar.isPending}>
              {limpar.isPending ? 'Limpando…' : 'Limpar comprados'}
            </Button>
          }
          titulo={n === 1 ? 'Tirar o item comprado da lista?' : `Tirar os ${n} itens comprados da lista?`}
          descricao="Eles saem da lista. Para comprar de novo, é só adicionar outra vez."
          confirmar="Limpar comprados"
          aoConfirmar={tirarDaLista}
        />
      </div>
      <ul className="flex flex-col divide-y divide-linha" aria-label="Já comprados">
        {itens.map((i) => (
          <LinhaItem key={i.id} item={i} />
        ))}
      </ul>
    </section>
  )
}

/** A linha inteira marca (alvo grande para usar com uma mão no mercado); o lápis abre a edição. */
function LinhaItem({ item: i }: { item: ItemCompra }) {
  const marcar = useMarcarComprado()
  const detalhe = i.comprado && i.compradoEm ? descreverCompra(i.compradoEm) : i.quantidade

  return (
    <li className="flex items-center gap-1 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={i.comprado}
        onClick={() => marcar.mutate({ id: i.id, comprado: !i.comprado })}
        className="-ml-2 flex min-h-16 min-w-0 flex-1 items-center gap-4 rounded-lg px-2 py-2 text-left outline-none hover:bg-areia/70 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg border-2',
            i.comprado ? 'border-ok bg-ok text-folha' : 'border-input bg-folha',
          )}
        >
          {i.comprado && <CheckIcon className="size-6" weight="bold" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn('text-lg font-semibold break-words', i.comprado && 'text-muted-foreground line-through')}
          >
            {i.nome}
          </span>
          {detalhe && <span className="text-base text-muted-foreground">{detalhe}</span>}
        </span>
      </button>
      <Link
        to={`/compras/${i.id}`}
        aria-label={`Editar ${i.nome}`}
        className="-mr-2 grid size-12 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-areia hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PencilSimpleIcon className="size-6" aria-hidden />
      </Link>
    </li>
  )
}
