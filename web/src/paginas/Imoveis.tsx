import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BuildingsIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { EstadoVazio } from '@/components/EstadoVazio'
import { BarraPago, PagoPendente, SituacaoContas } from '@/components/ResumoValores'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useExcluirImovel, useImoveis, useRelatorioFinanceiro, useSalvarImovel } from '@/consultas/pagamentos'
import { intervaloDoMes, mesDe } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import { aplicarErroApi } from '@/lib/formulario'
import type { Imovel, ValoresContas } from '@/lib/tipos'
import { NavegadorMes } from '@/paginas/pagamentos/ResumoContas'

// Mesmas regras de src/modules/imoveis/schema.js.
const esquema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do imóvel.').max(100, 'Nome longo demais.'),
})
type Dados = z.infer<typeof esquema>

/** Formulário de um campo só, usado para adicionar e para renomear. */
function FormNome({
  imovel,
  rotulo,
  textoBotao,
  aoTerminar,
  aoCancelar,
}: {
  imovel?: Imovel
  rotulo: string
  textoBotao: string
  aoTerminar?: () => void
  aoCancelar?: () => void
}) {
  const salvar = useSalvarImovel()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Dados>({ resolver: zodResolver(esquema), defaultValues: { nome: imovel?.nome ?? '' } })

  const enviar = (dados: Dados) =>
    salvar.mutate(
      { id: imovel?.id, nome: dados.nome },
      {
        onSuccess: (salvo) => {
          toast.success(imovel ? 'Nome alterado.' : `${salvo.nome} adicionado.`)
          reset({ nome: '' })
          aoTerminar?.()
        },
        onError: (erro) => aplicarErroApi(erro, setError, { porCodigo: { IMOVEL_DUPLICADO: 'nome' } }),
      },
    )

  return (
    <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-3">
      <Campo
        rotulo={rotulo}
        placeholder="Ex.: Casa da Serra"
        autoFocus={Boolean(imovel)}
        erro={errors.nome?.message ?? errors.root?.message}
        {...register('nome')}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={salvar.isPending}>
          {!imovel && <PlusIcon weight="bold" aria-hidden />}
          {salvar.isPending ? 'Salvando…' : textoBotao}
        </Button>
        {aoCancelar && (
          <Button type="button" variant="outline" onClick={aoCancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}

/** `valores`: as contas do imóvel no mês escolhido (do relatório financeiro; some enquanto carrega). */
function LinhaImovel({ imovel, valores }: { imovel: Imovel; valores?: ValoresContas }) {
  const [renomeando, setRenomeando] = useState(false)
  const excluir = useExcluirImovel()

  if (renomeando) {
    return (
      <li className="py-4">
        <FormNome
          imovel={imovel}
          rotulo={`Novo nome para ${imovel.nome}`}
          textoBotao="Salvar nome"
          aoTerminar={() => setRenomeando(false)}
          aoCancelar={() => setRenomeando(false)}
        />
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      {/* O imóvel abre o resumo dele (quanto custa, por categoria e mês a mês, e as contas). */}
      <Link
        to={`/imoveis/${imovel.id}`}
        className="-mx-2 flex flex-col gap-3 rounded-lg px-2 py-1 hover:bg-suave/60"
      >
        <span className="flex items-center gap-3">
          <span className="selo-area size-11" aria-hidden>
            <BuildingsIcon className="size-6" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-lg font-semibold">{imovel.nome}</span>
            {(imovel.endereco || imovel.complemento) && (
              <span className="text-base text-muted-foreground">
                {[imovel.endereco, imovel.complemento].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
          {valores && (
            <span className="shrink-0 text-lg font-bold tabular-nums">{formatarCentavos(valores.totalCentavos)}</span>
          )}
        </span>
        {valores && (
          <>
            <BarraPago v={valores} />
            <PagoPendente v={valores} />
            <SituacaoContas v={valores} />
          </>
        )}
      </Link>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setRenomeando(true)} aria-label={`Renomear ${imovel.nome}`}>
          <PencilSimpleIcon aria-hidden />
          Renomear
        </Button>
        <Confirmar
          gatilho={
            <Button variant="destructive" aria-label={`Excluir ${imovel.nome}`} disabled={excluir.isPending}>
              <TrashIcon aria-hidden />
              Excluir
            </Button>
          }
          titulo={`Excluir ${imovel.nome}?`}
          descricao="Só dá para excluir imóveis sem pagamentos ligados."
          confirmar="Excluir imóvel"
          aoConfirmar={() =>
            excluir.mutate(imovel.id, { onSuccess: () => toast.success(`${imovel.nome} excluído.`) })
          }
        />
      </div>
    </li>
  )
}

export function Imoveis() {
  const [params, setParams] = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesDe()
  const consulta = useImoveis()
  const imoveis = consulta.data ?? []
  const doMes = useRelatorioFinanceiro(intervaloDoMes(mes)).data?.imoveis ?? []

  return (
    <Pagina titulo="Imóveis">
      <div className="flex flex-col gap-8">
        <p className="max-w-prose text-lg text-muted-foreground">
          Separe as contas por imóvel para saber quanto cada um custa. Toque no imóvel para ver o resumo.
        </p>

        <section className="rounded-2xl bg-folha p-4 shadow-folha">
          <FormNome rotulo="Nome do imóvel" textoBotao="Adicionar imóvel" />
        </section>

        {imoveis.length > 0 && (
          <NavegadorMes
            mes={mes}
            aoMudar={(novo) => setParams(novo === mesDe() ? {} : { mes: novo }, { replace: true })}
          />
        )}

        {consulta.isPending ? (
          <Skeleton className="h-40" />
        ) : imoveis.length === 0 ? (
          <EstadoVazio icone={BuildingsIcon} titulo="Nenhum imóvel cadastrado">
            Adicione o primeiro acima. Pagamentos sem imóvel aparecem como "Sem imóvel" no relatório.
          </EstadoVazio>
        ) : (
          <ul className="flex flex-col divide-y divide-linha" aria-label="Seus imóveis">
            {imoveis.map((imovel) => (
              <LinhaImovel key={imovel.id} imovel={imovel} valores={doMes.find((i) => i.id === imovel.id)} />
            ))}
          </ul>
        )}
      </div>
    </Pagina>
  )
}
