import { useId, useState, type ChangeEvent } from 'react'
import { ArrowLeft, Download, FileText, Image, Paperclip, Pencil, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Confirmar } from '@/components/Confirmar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBaixarAnexo, useEnviarAnexo, useExcluirAnexo, useViagem } from '@/consultas/viagens'
import { ApiError } from '@/lib/api'
import type { AnexoViagem, Viagem } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import {
  contarAnexos,
  descreverPeriodo,
  formatarTamanho,
  MAXIMO_ANEXOS,
  situacaoViagem,
  TAMANHO_MAXIMO_MB,
  TIPOS_ACEITOS,
} from './textos'

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

function Anexos({ viagem }: { viagem: Viagem }) {
  const idEntrada = useId()
  const enviar = useEnviarAnexo(viagem.id)
  const [enviando, setEnviando] = useState<string | null>(null)
  const vagas = MAXIMO_ANEXOS - viagem.anexos.length

  async function escolher(evento: ChangeEvent<HTMLInputElement>) {
    const arquivos = [...(evento.target.files ?? [])]
    // Limpa para dar para escolher o mesmo arquivo de novo (ex.: depois de um erro).
    evento.target.value = ''
    if (arquivos.length > vagas) {
      toast.error(`Só cabem mais ${vagas === 1 ? '1 anexo' : `${vagas} anexos`} nesta viagem.`, {
        description: `Cada viagem pode ter no máximo ${MAXIMO_ANEXOS} anexos.`,
      })
      return
    }

    let enviados = 0
    for (const arquivo of arquivos) {
      // Checado aqui para não gastar internet enviando um arquivo que o servidor vai recusar.
      if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
        toast.error(`Não foi possível anexar ${arquivo.name}`, {
          description: `O arquivo pode ter no máximo ${TAMANHO_MAXIMO_MB} MB.`,
        })
        continue
      }
      setEnviando(arquivo.name)
      try {
        await enviar.mutateAsync(arquivo)
        enviados++
      } catch (erro) {
        if (erro instanceof ApiError && erro.codigo === 'NAO_AUTORIZADO') break
        toast.error(`Não foi possível anexar ${arquivo.name}`, {
          description: erro instanceof Error ? erro.message : undefined,
        })
      }
    }
    setEnviando(null)
    if (enviados > 0) toast.success(enviados === 1 ? 'Anexo adicionado.' : `${enviados} anexos adicionados.`)
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${idEntrada}-titulo`}>
      <h2 id={`${idEntrada}-titulo`} className="text-xl font-bold">
        Anexos
      </h2>
      <p className="text-base text-muted-foreground">
        Passagens, vouchers e reservas, em PDF ou foto (até {TAMANHO_MAXIMO_MB} MB cada).
      </p>

      {viagem.anexos.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label={contarAnexos(viagem.anexos.length)}>
          {viagem.anexos.map((a) => (
            <ItemAnexo key={a.id} viagemId={viagem.id} anexo={a} />
          ))}
        </ul>
      )}

      {enviando ? (
        <p role="status" className="rounded-xl border border-dashed bg-card p-4 font-semibold">
          Enviando {enviando}…
        </p>
      ) : vagas > 0 ? (
        <div>
          <input
            id={idEntrada}
            type="file"
            accept={TIPOS_ACEITOS}
            multiple
            className="peer sr-only"
            onChange={escolher}
          />
          <label
            htmlFor={idEntrada}
            className={cn(
              buttonVariants({ variant: viagem.anexos.length ? 'outline' : 'default', size: 'lg' }),
              'w-full cursor-pointer peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 sm:w-auto',
            )}
          >
            <Paperclip aria-hidden />
            Anexar arquivo
          </label>
        </div>
      ) : (
        <p className="text-base font-semibold">Esta viagem já tem {MAXIMO_ANEXOS} anexos, o máximo.</p>
      )}
    </section>
  )
}

function ItemAnexo({ viagemId, anexo: a }: { viagemId: string; anexo: AnexoViagem }) {
  const baixar = useBaixarAnexo(viagemId)
  const excluir = useExcluirAnexo(viagemId)
  const Icone = a.mimeType === 'application/pdf' ? FileText : Image

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Icone className="size-7 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold break-words">{a.nomeOriginal}</p>
          <p className="text-base text-muted-foreground">
            {a.mimeType === 'application/pdf' ? 'PDF' : 'Imagem'}, {formatarTamanho(a.tamanhoBytes)}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={() => baixar.mutate(a)}
          disabled={baixar.isPending}
          aria-label={`Baixar ${a.nomeOriginal}`}
        >
          <Download aria-hidden />
          {baixar.isPending ? 'Baixando…' : 'Baixar'}
        </Button>
        <Confirmar
          gatilho={
            <Button variant="destructive" size="icon" aria-label={`Excluir ${a.nomeOriginal}`}>
              <Trash2 aria-hidden />
            </Button>
          }
          titulo={`Excluir ${a.nomeOriginal}?`}
          descricao="O arquivo será apagado e não dá para recuperar."
          confirmar="Excluir anexo"
          aoConfirmar={() =>
            excluir.mutate(a.id, { onSuccess: () => toast.success(`${a.nomeOriginal} excluído.`) })
          }
        />
      </div>
    </li>
  )
}
