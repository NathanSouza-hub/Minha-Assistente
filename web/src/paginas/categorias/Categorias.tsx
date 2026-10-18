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
      <li className="py-4">
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
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <span className="flex flex-1 items-center gap-3 text-lg font-semibold">
        <span className="selo-area size-11" aria-hidden>
          <TagIcon className="size-6" />
        </span>
        {categoria.nome}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => mover(categoria, -1)}
          disabled={primeira || movendo}
          aria-label={`Subir ${categoria.nome}`}
        >
          <ArrowUpIcon weight="bold" aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => mover(categoria, 1)}
          disabled={ultima || movendo}
          aria-label={`Descer ${categoria.nome}`}
        >
          <ArrowDownIcon weight="bold" aria-hidden />
        </Button>
        <Button variant="outline" onClick={() => setRenomeando(true)} aria-label={`Renomear ${categoria.nome}`}>
          <PencilSimpleIcon aria-hidden />
          Renomear
        </Button>
        <Confirmar
          gatilho={
            <Button variant="destructive" aria-label={`Excluir ${categoria.nome}`} disabled={excluir.isPending}>
              <TrashIcon aria-hidden />
              Excluir
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
        <p className="max-w-prose text-lg text-muted-foreground">
          Cada categoria é uma aba na tela de Contas, nesta ordem. Crie as que precisar.
        </p>

        <section className="rounded-2xl bg-folha p-4 shadow-folha">
          <FormCategoria aoSalvar={(c) => toast.success(`${c.nome} criada.`)} />
        </section>

        {consulta.isPending ? (
          <Skeleton className="h-40" />
        ) : categorias.length === 0 ? (
          <EstadoVazio icone={TagIcon} titulo="Nenhuma categoria">
            Crie a primeira acima para separar suas contas.
          </EstadoVazio>
        ) : (
          <ul className="flex flex-col divide-y divide-linha" aria-label="Suas categorias">
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
