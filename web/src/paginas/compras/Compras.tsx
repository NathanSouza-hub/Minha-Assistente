import { useEffect, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PencilSimpleIcon, PlusIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Lista, LinhaMarcavel } from '@/components/Linha'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCompras, useLimparComprados, useMarcarComprado, useSalvarItem } from '@/consultas/compras'
import { chaveCategoria } from '@/lib/compras'
import { aplicarErroApi } from '@/lib/formulario'
import type { ItemCompra } from '@/lib/tipos'
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

  // Quantos já foram para o carrinho, no canto do cabeçalho (sem barra: a lista já mostra o resto).
  const contador =
    itens.length > 0 ? (
      <p className="pb-1 text-apoio font-semibold text-muted-foreground" aria-live="polite">
        {comprados.length === itens.length
          ? 'Tudo comprado.'
          : `${comprados.length} de ${itens.length} ${itens.length === 1 ? 'item comprado' : 'itens comprados'}`}
      </p>
    ) : undefined

  return (
    <Pagina titulo="Compras" acoes={contador}>
      <div className="flex flex-col gap-6">
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
            {pendentes.length > 0 ? (
              <Pendentes itens={pendentes} />
            ) : (
              <p className="rounded-[1.25rem] bg-ok-fundo px-4 py-3 font-semibold text-ok">Tudo o que estava na lista foi comprado.</p>
            )}
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

  const idLista = useId()
  // Anotar rápido: o nome e o "+" numa linha; quantidade e categoria (opcionais) logo abaixo, menores.
  // No computador, tudo numa linha só.
  return (
    <form
      noValidate
      onSubmit={handleSubmit(enviar)}
      aria-label="Adicionar item"
      className="area-compras grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-[1.75rem] bg-folha p-3 shadow-[var(--shadow-folha)] sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto] sm:p-4"
    >
      <div className="col-start-1 row-start-1 min-w-0">
        <Campo
          rotulo="O que falta comprar?"
          rotuloOculto
          placeholder="O que falta comprar?"
          autoComplete="off"
          enterKeyHint="done"
          className="h-12 rounded-full border-0 bg-suave px-5 text-[1.05rem]"
          erro={errors.nome?.message}
          {...register('nome')}
        />
      </div>
      <div className="col-span-2 row-start-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <Campo
          rotulo="Quantidade"
          rotuloOculto
          placeholder="Quantidade"
          autoComplete="off"
          className="h-12 rounded-full"
          erro={errors.quantidade?.message}
          {...register('quantidade')}
        />
        <Campo
          rotulo="Categoria"
          rotuloOculto
          placeholder="Categoria"
          list={idLista}
          autoComplete="off"
          className="h-12 rounded-full"
          erro={errors.categoria?.message}
          {...register('categoria')}
        />
        <datalist id={idLista}>
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      {/* No celular só o "+" ao lado do nome; no computador, com o texto, no fim da linha. */}
      <Button
        type="submit"
        disabled={isSubmitting}
        aria-label="Adicionar à lista"
        className="col-start-2 row-start-1 size-12 bg-area px-0 text-white hover:bg-area/90 sm:col-start-3 sm:w-auto sm:px-5"
      >
        <PlusIcon weight="bold" className="size-6 sm:size-5" aria-hidden />
        <span className="hidden sm:inline">Adicionar</span>
      </Button>
      {errors.root && (
        <p role="alert" className="col-span-full font-semibold text-destructive">
          {errors.root.message}
        </p>
      )}
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

  // Cada lugar (mercado, farmácia...) num bloco com o nome em cima: na loja, olha-se um bloco só.
  // No computador, os blocos ficam em duas colunas.
  return (
    <section aria-labelledby="a-comprar" className="flex flex-col gap-3">
      <h2 id="a-comprar" className="text-secao font-bold">
        A comprar <span className="font-sans text-apoio font-semibold text-muted-foreground">· {itens.length}</span>
      </h2>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {[...grupos].map(([chave, { titulo, itens: doGrupo }]) => (
          <div key={chave} className="superficie overflow-hidden pt-3">
            {!soUmSemCategoria && (
              <h3 className="px-4 text-[0.8rem] font-bold tracking-[0.08em] text-area uppercase">{titulo}</h3>
            )}
            <Lista rotulo={soUmSemCategoria ? 'A comprar' : titulo} className="rounded-none shadow-none">
              {doGrupo.map((i) => (
                <LinhaItem key={i.id} item={i} />
              ))}
            </Lista>
          </div>
        ))}
      </div>
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
    <section aria-labelledby="ja-comprados" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ja-comprados" className="text-base font-bold text-muted-foreground">
          Já comprados · {n}
        </h2>
        <Confirmar
          gatilho={
            <Button variant="ghost" size="sm" disabled={limpar.isPending} className="text-muted-foreground">
              {limpar.isPending ? 'Limpando…' : 'Limpar comprados'}
            </Button>
          }
          titulo={n === 1 ? 'Tirar o item comprado da lista?' : `Tirar os ${n} itens comprados da lista?`}
          descricao="Eles saem da lista. Para comprar de novo, é só adicionar outra vez."
          confirmar="Limpar comprados"
          aoConfirmar={tirarDaLista}
        />
      </div>
      <Lista rotulo="Já comprados" className="bg-folha/60 shadow-none">
        {itens.map((i) => (
          <LinhaItem key={i.id} item={i} />
        ))}
      </Lista>
    </section>
  )
}

/** O círculo marca (como no Início); o lápis abre a edição. */
function LinhaItem({ item: i }: { item: ItemCompra }) {
  const marcar = useMarcarComprado()
  const detalhe = i.comprado && i.compradoEm ? descreverCompra(i.compradoEm) : i.quantidade

  return (
    <LinhaMarcavel
      estado={i.comprado ? 'feito' : 'pendente'}
      marcar={{
        rotulo: i.nome,
        papel: 'checkbox',
        marcado: i.comprado,
        aoMarcar: () => marcar.mutate({ id: i.id, comprado: !i.comprado }),
      }}
      titulo={i.nome}
      apoio={detalhe}
      meioMarca
      fim={
        <Link
          to={`/compras/${i.id}`}
          aria-label={`Editar ${i.nome}`}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-suave hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <PencilSimpleIcon className="size-5" aria-hidden />
        </Link>
      }
    />
  )
}
