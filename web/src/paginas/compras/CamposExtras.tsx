import { useId } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Campo } from '@/components/Campo'
import type { DadosItem } from './formulario'

/** Quantidade e categoria lado a lado (curtos); a categoria sugere as já usadas. */
export function CamposExtras({
  register,
  errors,
  categorias,
}: {
  register: UseFormRegister<DadosItem>
  errors: FieldErrors<DadosItem>
  categorias: string[]
}) {
  const idLista = useId()
  return (
    <div className="grid grid-cols-2 gap-4">
      <Campo
        rotulo="Quantidade"
        placeholder="Ex.: 2 kg"
        autoComplete="off"
        erro={errors.quantidade?.message}
        {...register('quantidade')}
      />
      <Campo
        rotulo="Categoria"
        placeholder="Ex.: Mercado"
        list={idLista}
        autoComplete="off"
        erro={errors.categoria?.message}
        {...register('categoria')}
      />
      <datalist id={idLista}>
        {categorias.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  )
}
