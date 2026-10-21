import { useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { Selecao } from '@/components/Selecao'
import { useCategorias } from '@/consultas/pagamentos'
import { FormCategoria } from './FormCategoria'

const NOVA_CATEGORIA = '__nova__'

type Props = {
  /** `register('categoriaId')`: nome, ref e blur do campo (a mudança passa por `aoMudar`). */
  registro: UseFormRegisterReturn
  valor: string
  /** Chamado com a categoria escolhida ou com a recém-criada. */
  aoMudar: (id: string) => void
  erro?: string
  rotulo?: string
  /** Texto da opção vazia; `opcional` deixa escolher "sem categoria" (senão ela só orienta). */
  vazio?: { rotulo: string; opcional?: boolean }
}

/**
 * Categoria de um cadastro, com "+ Nova categoria…" no fim da lista: cria ali mesmo (sem sair da
 * tela) e já deixa a nova escolhida. A tela Categorias está oculta do menu (decisão 33).
 * Controlado: a categoria criada é escolhida antes de a <option> dela aparecer; sem `value`, o
 * <select> descartaria o valor e ficaria na primeira opção.
 */
export function CampoCategoria({
  registro,
  valor,
  aoMudar,
  erro,
  rotulo = 'Categoria',
  vazio = { rotulo: 'Escolha a categoria' },
}: Props) {
  const { data: categorias = [] } = useCategorias()
  const [criando, setCriando] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <Selecao
        rotulo={rotulo}
        erro={erro}
        {...registro}
        value={valor}
        onChange={(e) => {
          if (e.target.value !== NOVA_CATEGORIA) return aoMudar(e.target.value)
          aoMudar('')
          setCriando(true)
        }}
      >
        <option value="" disabled={!vazio.opcional}>
          {vazio.rotulo}
        </option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
        <option value={NOVA_CATEGORIA}>+ Nova categoria…</option>
      </Selecao>
      {criando && (
        <div className="rounded-2xl bg-folha p-4 shadow-folha">
          <FormCategoria
            rotulo="Nome da nova categoria"
            autoFocus
            aoSalvar={(nova) => {
              aoMudar(nova.id)
              setCriando(false)
            }}
            aoCancelar={() => setCriando(false)}
          />
        </div>
      )}
    </div>
  )
}
