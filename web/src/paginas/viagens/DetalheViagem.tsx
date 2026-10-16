import { ArrowLeft, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { ListaArquivos, type TextosArquivos } from '@/components/ListaArquivos'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBaixarAnexo, useEnviarAnexo, useExcluirAnexo, useViagem } from '@/consultas/viagens'
import { TAMANHO_MAXIMO_MB } from '@/lib/arquivos'
import type { Viagem } from '@/lib/tipos'
import { descreverPeriodo, MAXIMO_ANEXOS, situacaoViagem } from './textos'

const voltar = (
  <Link to="/viagens" className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary">
    <ArrowLeft className="size-5" aria-hidden />
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
  const { texto } = situacaoViagem(v.ida, v.volta)
  const detalhes = [
    ['Hospedagem', v.hospedagem],
    ['Transporte', v.transporte],
    ['Observações', v.observacoes],
  ].filter((d): d is [string, string] => Boolean(d[1]))

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
            <Pencil aria-hidden />
            Editar
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        <dl className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <div>
            <dt className="text-base text-muted-foreground">Quando</dt>
            <dd className="text-lg font-semibold">{descreverPeriodo(v.ida, v.volta)}</dd>
            {texto && <dd className="font-semibold text-primary">{texto}</dd>}
          </div>
          {detalhes.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-base text-muted-foreground">{rotulo}</dt>
              <dd className="text-lg break-words whitespace-pre-line">{valor}</dd>
            </div>
          ))}
        </dl>
        <Anexos viagem={v} />
      </div>
    </Pagina>
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
