import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Tags, Trash2 } from 'lucide-react'
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
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <span className="flex flex-1 items-center gap-3 text-lg font-semibold">
        <Tags className="size-6 shrink-0 text-primary" aria-hidden />
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
          <ArrowUp aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => mover(categoria, 1)}
          disabled={ultima || movendo}
          aria-label={`Descer ${categoria.nome}`}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button variant="outline" onClick={() => setRenomeando(true)} aria-label={`Renomear ${categoria.nome}`}>
          <Pencil aria-hidden />
          Renomear
        </Button>
        <Confirmar
          gatilho={
            <Button variant="destructive" aria-label={`Excluir ${categoria.nome}`} disabled={excluir.isPending}>
              <Trash2 aria-hidden />
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

        <section className="rounded-xl border bg-card p-4">
          <FormCategoria aoSalvar={(c) => toast.success(`${c.nome} criada.`)} />
        </section>

        {consulta.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : categorias.length === 0 ? (
          <EstadoVazio icone={Tags} titulo="Nenhuma categoria">
            Crie a primeira acima para separar suas contas.
          </EstadoVazio>
        ) : (
          <ul className="divide-y rounded-xl border bg-card" aria-label="Suas categorias">
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
