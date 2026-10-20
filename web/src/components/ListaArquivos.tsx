import { useId, useState, type ChangeEvent } from 'react'
import { DownloadSimpleIcon, FilePdfIcon, ImageIcon, PaperclipIcon, TrashIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Confirmar } from '@/components/Confirmar'
import { Button, buttonVariants } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { formatarTamanho, TAMANHO_MAXIMO_MB, TIPOS_ACEITOS } from '@/lib/arquivos'
import type { ArquivoEnviado } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/** Palavras da tela: "anexo/anexos", "nesta viagem"... (ambos os usos são masculinos). */
export type TextosArquivos = {
  singular: string
  plural: string
  /** "Cada viagem" */
  cada: string
  /** "nesta viagem" */
  local: string
  /** "Esta viagem" */
  este: string
  botao: string
}

type Props = {
  titulo: string
  descricao: string
  arquivos: ArquivoEnviado[]
  maximo: number
  textos: TextosArquivos
  enviar: (arquivo: File) => Promise<unknown>
  baixar: (arquivo: ArquivoEnviado) => Promise<unknown>
  excluir: (arquivo: ArquivoEnviado) => Promise<unknown>
}

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/**
 * Lista de arquivos com enviar (vários de uma vez, um por vez para o servidor), baixar e excluir.
 * Usada nos anexos de viagem e nos comprovantes de conta.
 */
export function ListaArquivos({ titulo, descricao, arquivos, maximo, textos: t, enviar, baixar, excluir }: Props) {
  const idEntrada = useId()
  const [enviando, setEnviando] = useState<string | null>(null)
  const vagas = maximo - arquivos.length
  const contar = (n: number) => (n === 1 ? `1 ${t.singular}` : `${n} ${t.plural}`)

  async function escolher(evento: ChangeEvent<HTMLInputElement>) {
    const escolhidos = [...(evento.target.files ?? [])]
    // Limpa para dar para escolher o mesmo arquivo de novo (ex.: depois de um erro).
    evento.target.value = ''
    if (escolhidos.length > vagas) {
      toast.error(`Só cabem mais ${contar(vagas)} ${t.local}.`, {
        description: `${t.cada} pode ter no máximo ${maximo} ${t.plural}.`,
      })
      return
    }

    let enviados = 0
    for (const arquivo of escolhidos) {
      // Checado aqui para não gastar internet enviando um arquivo que o servidor vai recusar.
      if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
        toast.error(`Não foi possível anexar ${arquivo.name}`, {
          description: `O arquivo pode ter no máximo ${TAMANHO_MAXIMO_MB} MB.`,
        })
        continue
      }
      setEnviando(arquivo.name)
      try {
        await enviar(arquivo)
        enviados++
      } catch (erro) {
        if (erro instanceof ApiError && erro.codigo === 'NAO_AUTORIZADO') break
        toast.error(`Não foi possível anexar ${arquivo.name}`, {
          description: erro instanceof Error ? erro.message : undefined,
        })
      }
    }
    setEnviando(null)
    if (enviados > 0) {
      toast.success(enviados === 1 ? `${maiuscula(t.singular)} adicionado.` : `${enviados} ${t.plural} adicionados.`)
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${idEntrada}-titulo`}>
      <h2 id={`${idEntrada}-titulo`} className="text-xl font-bold">
        {titulo}
      </h2>
      <p className="text-base text-muted-foreground">{descricao}</p>

      {arquivos.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label={contar(arquivos.length)}>
          {arquivos.map((a) => (
            <ItemArquivo key={a.id} arquivo={a} singular={t.singular} baixar={baixar} excluir={excluir} />
          ))}
        </ul>
      )}

      {enviando ? (
        <p role="status" className="rounded-xl bg-suave p-4 font-semibold">
          Enviando {enviando}…
        </p>
      ) : vagas > 0 ? (
        <div>
          <input id={idEntrada} type="file" accept={TIPOS_ACEITOS} multiple className="peer sr-only" onChange={escolher} />
          <label
            htmlFor={idEntrada}
            className={cn(
              buttonVariants({ variant: arquivos.length ? 'outline' : 'default', size: 'lg' }),
              'w-full cursor-pointer peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 sm:w-auto',
            )}
          >
            <PaperclipIcon aria-hidden />
            {t.botao}
          </label>
        </div>
      ) : (
        <p className="text-base font-semibold">
          {t.este} já tem {maximo} {t.plural}, o máximo.
        </p>
      )}
    </section>
  )
}

function ItemArquivo({
  arquivo: a,
  singular,
  baixar,
  excluir,
}: {
  arquivo: ArquivoEnviado
  singular: string
  baixar: Props['baixar']
  excluir: Props['excluir']
}) {
  const [baixando, setBaixando] = useState(false)
  const Icone = a.mimeType === 'application/pdf' ? FilePdfIcon : ImageIcon

  function aoBaixar() {
    setBaixando(true)
    baixar(a)
      .catch(() => {})
      .finally(() => setBaixando(false))
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl bg-folha p-4 shadow-folha sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="selo-area size-11" aria-hidden><Icone className="size-6" /></span>
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
          onClick={aoBaixar}
          disabled={baixando}
          aria-label={`Baixar ${a.nomeOriginal}`}
        >
          <DownloadSimpleIcon aria-hidden />
          {baixando ? 'Baixando…' : 'Baixar'}
        </Button>
        <Confirmar
          gatilho={
            <Button variant="destructive" size="icon" aria-label={`Excluir ${a.nomeOriginal}`}>
              <TrashIcon aria-hidden />
            </Button>
          }
          titulo={`Excluir ${a.nomeOriginal}?`}
          descricao="O arquivo será apagado e não dá para recuperar."
          confirmar={`Excluir ${singular}`}
          aoConfirmar={() =>
            void excluir(a)
              .then(() => toast.success(`${a.nomeOriginal} excluído.`))
              .catch(() => {})
          }
        />
      </div>
    </li>
  )
}
