import type { ReactNode } from 'react'
import { Tabs } from 'radix-ui'
import { useSearchParams } from 'react-router'
import { cn } from '@/lib/utils'

export type Aba<T extends string> = {
  valor: T
  rotulo: string
  /** Número ao lado do rótulo (ex.: quantas contas a pagar); 0 ou sem valor não aparece. */
  contador?: number
  conteudo: ReactNode
}

/**
 * Divisões internas de uma tela (ex.: Despesas | A pagar | Por categoria), em texto com o
 * sublinhado azul no ativo (igual ao menu da área no celular). A aba escolhida mora na
 * URL (`?<parametro>=`), então recarregar ou voltar de um formulário mantém a mesma. A primeira é a
 * padrão e não aparece na URL. Teclado e leitores de tela pelo Tabs do Radix.
 */
export function Abas<T extends string>({
  rotulo,
  abas,
  parametro = 'vista',
}: {
  rotulo: string
  abas: Aba<T>[]
  parametro?: string
}) {
  const [params, setParams] = useSearchParams()
  const pedida = params.get(parametro)
  const atual = abas.find((a) => a.valor === pedida)?.valor ?? abas[0].valor

  const mudar = (valor: string) =>
    setParams(
      (antes) => {
        const novo = new URLSearchParams(antes)
        if (valor === abas[0].valor) novo.delete(parametro)
        else novo.set(parametro, valor)
        return novo
      },
      { replace: true },
    )

  return (
    <Tabs.Root value={atual} onValueChange={mudar} className="flex flex-col gap-5">
      {/* Rola para o lado no celular estreito em vez de quebrar a linha. */}
      <Tabs.List
        aria-label={rotulo}
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-linha px-4 [scrollbar-width:none] md:mx-0 md:px-0"
      >
        {abas.map(({ valor, rotulo: nome, contador }) => (
          <Tabs.Trigger
            key={valor}
            value={valor}
            className={cn(
              '-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-[3px] border-transparent px-3 text-base font-medium whitespace-nowrap text-muted-foreground outline-none',
              'hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
              'data-[state=active]:border-primary data-[state=active]:font-bold data-[state=active]:text-foreground',
            )}
          >
            {nome}
            {Boolean(contador) && (
              <span className="rounded-full bg-suave px-2 text-sm font-semibold tabular-nums text-foreground">{contador}</span>
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {abas.map((a) => (
        <Tabs.Content key={a.valor} value={a.valor} className="outline-none">
          {a.conteudo}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
