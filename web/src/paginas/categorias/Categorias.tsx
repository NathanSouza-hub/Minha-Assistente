import { useState } from 'react'
import { ArrowDownIcon, ArrowUpIcon, PencilSimpleIcon, TagIcon, TrashIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Confirmar } from '@/components/Confirmar'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategorias, useExcluirCategoria, useSalvarCategoria } from '@/consultas/pagamentos'
import type { CategoriaPagamento } from '@/lib/tipos'
import { FormCategoria } from './FormCategoria'

type Mover = (categoria: CategoriaPagamento, passo: -1 | 1) => void

function LinhaCategoria({
  categoria,
  primeira,
  ultima,
  mover,
  movendo,
}: {
  categoria: CategoriaPagamento
  primeira: boolean
  ultima: boolean
  mover: Mover
  movendo: boolean
}) {
  const [renomeando, setRenomeando] = useState(false)
  const excluir = useExcluirCategoria()

  if (renomeando) {
    return (
      <li className="p-4">
        <FormCategoria
          categoria={categoria}
          rotulo={`Novo nome para ${categoria.nome}`}
          textoBotao="Salvar nome"
          autoFocus
          aoSalvar={() => {
            toast.success('Nome alterado.')
            setRenomeando(false)
          }}
          aoCancelar={() => setRenomeando(false)}
        />
      </li>
    )
  }

  return (
    <li className="flex items-center gap-1 py-1.5 pr-2 pl-4">
      <span className="min-w-0 flex-1 py-2 leading-snug font-semibold break-words">{categoria.nome}</span>
      <div className="flex shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground"
          onClick={() => mover(categoria, -1)}
          disabled={primeira || movendo}
          aria-label={`Subir ${categoria.nome}`}
        >
          <ArrowUpIcon weight="bold" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground"
          onClick={() => mover(categoria, 1)}
          disabled={ultima || movendo}
          aria-label={`Descer ${categoria.nome}`}
        >
          <ArrowDownIcon weight="bold" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground"
          onClick={() => setRenomeando(true)}
          aria-label={`Renomear ${categoria.nome}`}
          title="Renomear"
        >
          <PencilSimpleIcon className="size-5" aria-hidden />
        </Button>
        <Confirmar
          gatilho={
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Excluir ${categoria.nome}`}
              title="Excluir"
              disabled={excluir.isPending}
            >
              <TrashIcon className="size-5" aria-hidden />
            </Button>
          }
          titulo={`Excluir ${categoria.nome}?`}
          descricao="Só dá para excluir categorias sem contas. A aba dela some da tela de Contas."
          confirmar="Excluir categoria"
          aoConfirmar={() =>
            excluir.mutate(categoria.id, { onSuccess: () => toast.success(`${categoria.nome} excluída.`) })
          }
        />
      </div>
    </li>
  )
}

export function Categorias() {
  const consulta = useCategorias()
  const categorias = consulta.data ?? []
  const salvar = useSalvarCategoria()
  const [movendo, setMovendo] = useState(false)

  // Troca de lugar com a vizinha e regrava a ordem 1..n só de quem mudou.
  const mover: Mover = async (categoria, passo) => {
    const lista = [...categorias]
    const i = lista.findIndex((c) => c.id === categoria.id)
    ;[lista[i], lista[i + passo]] = [lista[i + passo], lista[i]]
    const mudaram = lista
      .map((c, n) => ({ id: c.id, ordem: n + 1 }))
      .filter((c) => categorias.find((original) => original.id === c.id)?.ordem !== c.ordem)
    setMovendo(true)
    try {
      for (const c of mudaram) await salvar.mutateAsync(c)
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível mudar a ordem.')
    } finally {
      setMovendo(false)
    }
  }

  return (
    <Pagina titulo="Categorias">
      <div className="flex flex-col gap-8">
        <p className="max-w-prose text-muted-foreground">
          Cada categoria é uma aba na tela de Contas, nesta ordem. Crie as que precisar.
        </p>

        <section className="superficie p-4 sm:max-w-xl">
          <FormCategoria aoSalvar={(c) => toast.success(`${c.nome} criada.`)} />
        </section>

        {consulta.isPending ? (
          <Skeleton className="h-40 max-w-3xl rounded-2xl" />
        ) : categorias.length === 0 ? (
          <EstadoVazio icone={TagIcon} titulo="Nenhuma categoria">
            Crie a primeira acima para separar suas contas.
          </EstadoVazio>
        ) : (
          <ul className="superficie flex max-w-3xl flex-col divide-y divide-linha overflow-hidden" aria-label="Suas categorias">
            {categorias.map((categoria, i) => (
              <LinhaCategoria
                key={categoria.id}
                categoria={categoria}
                primeira={i === 0}
                ultima={i === categorias.length - 1}
                mover={mover}
                movendo={movendo}
              />
            ))}
          </ul>
        )}
      </div>
    </Pagina>
  )
}
