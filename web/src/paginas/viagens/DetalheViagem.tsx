import type { ReactNode } from 'react'
import { AirplaneTiltIcon, ArrowLeftIcon, BedIcon, CalendarDotsIcon, NoteIcon, PencilSimpleIcon, type Icon } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { ListaArquivos, type TextosArquivos } from '@/components/ListaArquivos'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBaixarAnexo, useEnviarAnexo, useExcluirAnexo, useViagem } from '@/consultas/viagens'
import { TAMANHO_MAXIMO_MB } from '@/lib/arquivos'
import type { Viagem } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { descreverPeriodo, MAXIMO_ANEXOS, situacaoViagem } from './textos'

const voltar = (
  <Link to="/viagens" className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary">
    <ArrowLeftIcon className="size-5" weight="bold" aria-hidden />
    Viagens
  </Link>
)

/** /viagens/:id — dados da viagem e anexos (passagens, vouchers). */
export function DetalheViagem() {
  const { id } = useParams()
  const consulta = useViagem(id)

  if (consulta.isPending) {
    return (
      <Pagina titulo="Viagem">
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20" />
          ))}
        </div>
      </Pagina>
    )
  }
  if (consulta.isError) {
    return (
      <Pagina titulo="Viagem não encontrada">
        <p className="mb-4 text-lg">Esta viagem não existe mais ou foi excluída.</p>
        <Button asChild variant="outline">
          <Link to="/viagens">Voltar para minhas viagens</Link>
        </Button>
      </Pagina>
    )
  }

  const v = consulta.data
  const { fase, texto } = situacaoViagem(v.ida, v.volta)
  const detalhes: [string, string | null, Icon][] = [
    ['Hospedagem', v.hospedagem, BedIcon],
    ['Transporte', v.transporte, AirplaneTiltIcon],
    ['Observações', v.observacoes, NoteIcon],
  ]

  return (
    <Pagina
      titulo={v.destino}
      cabecalho={
        <div className="flex min-w-0 flex-col gap-2">
          {voltar}
          <h1 className="text-3xl leading-tight font-bold break-words">{v.destino}</h1>
        </div>
      }
      acoes={
        <Button asChild variant="outline">
          <Link to={`/viagens/${v.id}/editar`}>
            <PencilSimpleIcon aria-hidden />
            Editar
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        <dl className="flex flex-col divide-y divide-linha">
          <Detalhe rotulo="Quando" icone={CalendarDotsIcon}>
            <dd className="text-lg font-semibold">{descreverPeriodo(v.ida, v.volta)}</dd>
            {texto && <dd className={cn('font-semibold', fase === 'agora' ? 'text-terracota' : 'text-area')}>{texto}</dd>}
          </Detalhe>
          {detalhes.map(
            ([rotulo, valor, icone]) =>
              valor && (
                <Detalhe key={rotulo} rotulo={rotulo} icone={icone}>
                  <dd className="text-lg break-words whitespace-pre-line">{valor}</dd>
                </Detalhe>
              ),
          )}
        </dl>
        <Anexos viagem={v} />
      </div>
    </Pagina>
  )
}

/** Uma linha dos dados da viagem: selo da área com o ícone, rótulo e valor. */
function Detalhe({ rotulo, icone: Icone, children }: { rotulo: string; icone: Icon; children: ReactNode }) {
  return (
    <div className="flex gap-4 py-4 first:pt-0">
      <span className="selo-area size-11" aria-hidden>
        <Icone className="size-6" />
      </span>
      <div className="min-w-0">
        <dt className="text-base text-muted-foreground">{rotulo}</dt>
        {children}
      </div>
    </div>
  )
}

const TEXTOS_ANEXOS: TextosArquivos = {
  singular: 'anexo',
  plural: 'anexos',
  cada: 'Cada viagem',
  local: 'nesta viagem',
  este: 'Esta viagem',
  botao: 'Anexar arquivo',
}

function Anexos({ viagem }: { viagem: Viagem }) {
  const enviar = useEnviarAnexo(viagem.id)
  const baixar = useBaixarAnexo(viagem.id)
  const excluir = useExcluirAnexo(viagem.id)
  return (
    <ListaArquivos
      titulo="Anexos"
      descricao={`Passagens, vouchers e reservas, em PDF ou foto (até ${TAMANHO_MAXIMO_MB} MB cada).`}
      arquivos={viagem.anexos}
      maximo={MAXIMO_ANEXOS}
      textos={TEXTOS_ANEXOS}
      enviar={enviar.mutateAsync}
      baixar={baixar.mutateAsync}
      excluir={(a) => excluir.mutateAsync(a.id)}
    />
  )
}
