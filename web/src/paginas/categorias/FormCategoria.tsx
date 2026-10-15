import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { Campo } from '@/components/Campo'
import { Button } from '@/components/ui/button'
import { useSalvarCategoria } from '@/consultas/pagamentos'
import { aplicarErroApi } from '@/lib/formulario'
import type { CategoriaPagamento } from '@/lib/tipos'

// Mesmas regras de src/modules/categorias/schema.js.
const esquema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da categoria.').max(40, 'Nome longo demais.'),
})
type Dados = z.infer<typeof esquema>

type Props = {
  /** Sem categoria cria uma nova; com, renomeia. */
  categoria?: CategoriaPagamento
  rotulo?: string
  textoBotao?: string
  autoFocus?: boolean
  aoSalvar?: (categoria: CategoriaPagamento) => void
  aoCancelar?: () => void
}

/**
 * Campo para digitar o nome de uma categoria. Não é um <form> (um não pode ficar dentro de outro e
 * este aparece dentro do formulário de conta): envia pelo botão ou com Enter no campo.
 */
export function FormCategoria({
  categoria,
  rotulo = 'Nome da categoria',
  textoBotao = 'Criar categoria',
  autoFocus,
  aoSalvar,
  aoCancelar,
}: Props) {
  const salvar = useSalvarCategoria()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Dados>({ resolver: zodResolver(esquema), defaultValues: { nome: categoria?.nome ?? '' } })

  const enviar = (dados: Dados) =>
    salvar.mutate(
      { id: categoria?.id, nome: dados.nome },
      {
        onSuccess: (salva) => {
          reset({ nome: '' })
          aoSalvar?.(salva)
        },
        onError: (erro) => aplicarErroApi(erro, setError, { porCodigo: { CATEGORIA_DUPLICADA: 'nome' } }),
      },
    )

  const enviarAgora = () => void handleSubmit(enviar)()

  return (
    <div className="flex flex-col gap-3">
      <Campo
        rotulo={rotulo}
        placeholder="Ex.: Plano de saúde"
        autoFocus={autoFocus}
        enterKeyHint="done"
        erro={errors.nome?.message ?? errors.root?.message}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          enviarAgora()
        }}
        {...register('nome')}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={enviarAgora} disabled={salvar.isPending}>
          {!categoria && <Plus aria-hidden />}
          {salvar.isPending ? 'Salvando…' : textoBotao}
        </Button>
        {aoCancelar && (
          <Button type="button" variant="outline" onClick={aoCancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}
