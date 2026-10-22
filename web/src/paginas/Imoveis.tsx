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
import { SituacaoContas } from '@/components/ResumoValores'
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

/** Cartão do imóvel; `valores`: as contas dele no mês escolhido (do relatório financeiro; enquanto carrega, um esqueleto). */
function CartaoImovel({ imovel, valores }: { imovel: Imovel; valores?: ValoresContas }) {
  const [renomeando, setRenomeando] = useState(false)
  const excluir = useExcluirImovel()

  if (renomeando) {
    return (
      <li className="p-4">
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
    <li className="flex items-start gap-1 py-1 pr-2">
      {/* A linha abre o resumo do imóvel (quanto custa, por categoria e mês a mês, as contas e os dados). */}
      <Link to={`/imoveis/${imovel.id}`} className="flex min-w-0 flex-1 flex-col gap-1 py-2.5 pl-4 hover:bg-suave/40">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 leading-snug font-semibold">{imovel.nome}</span>
          {valores ? (
            <span className="shrink-0 font-bold tabular-nums">{formatarCentavos(valores.totalCentavos)}</span>
          ) : (
            <Skeleton className="h-5 w-24" />
          )}
        </span>
        {(imovel.endereco || imovel.complemento) && (
          <span className="text-[0.88rem] text-muted-foreground">
            {[imovel.endereco, imovel.complemento].filter(Boolean).join(' · ')}
          </span>
        )}
        {valores && (
          <span className="flex flex-col text-[0.88rem] text-muted-foreground">
            <SituacaoContas v={valores} />
            {valores.totalCentavos > 0 && (
              <span className="tabular-nums">
                Pago {formatarCentavos(valores.pagoCentavos)} · a pagar {formatarCentavos(valores.pendenteCentavos)}
              </span>
            )}
          </span>
        )}
      </Link>
      <div className="flex shrink-0 pt-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground"
          onClick={() => setRenomeando(true)}
          aria-label={`Renomear ${imovel.nome}`}
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
              aria-label={`Excluir ${imovel.nome}`}
              title="Excluir"
              disabled={excluir.isPending}
            >
              <TrashIcon className="size-5" aria-hidden />
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
  const [adicionando, setAdicionando] = useState(false)
  // Sem nenhum imóvel o formulário já aparece aberto: é a única coisa a fazer na tela.
  const formularioAberto = adicionando || (!consulta.isPending && imoveis.length === 0)

  return (
    <Pagina
      titulo="Imóveis"
      acoes={
        <Button variant="secondary" onClick={() => setAdicionando(true)} disabled={formularioAberto}>
          <PlusIcon weight="bold" aria-hidden />
          Novo imóvel
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="max-w-prose text-muted-foreground">
          Separe as contas por imóvel para saber quanto cada um custa. Toque no imóvel para ver o resumo.
        </p>

        {formularioAberto && (
          <section aria-label="Adicionar imóvel" className="superficie p-4 sm:max-w-xl">
            <FormNome
              rotulo="Nome do imóvel"
              textoBotao="Adicionar imóvel"
              aoTerminar={() => setAdicionando(false)}
              aoCancelar={imoveis.length > 0 ? () => setAdicionando(false) : undefined}
            />
          </section>
        )}

        {imoveis.length > 0 && (
          <NavegadorMes
            mes={mes}
            aoMudar={(novo) => setParams(novo === mesDe() ? {} : { mes: novo }, { replace: true })}
          />
        )}

        {consulta.isPending ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : imoveis.length === 0 ? (
          <EstadoVazio icone={BuildingsIcon} titulo="Nenhum imóvel cadastrado">
            Adicione o primeiro acima. Pagamentos sem imóvel aparecem como "Sem imóvel" no relatório.
          </EstadoVazio>
        ) : (
          <ul className="superficie flex flex-col divide-y divide-linha overflow-hidden" aria-label="Seus imóveis">
            {imoveis.map((imovel) => (
              <CartaoImovel key={imovel.id} imovel={imovel} valores={doMes.find((i) => i.id === imovel.id)} />
            ))}
          </ul>
        )}
      </div>
    </Pagina>
  )
}
