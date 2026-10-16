// Upload nos mocks (anexos de viagem, comprovantes de conta) — como src/middlewares/upload.js,
// src/lib/tipoArquivo.js e src/lib/anexos.js do back-end.
import { erro } from './util'

export const TAMANHO_MAXIMO = 10 * 1024 * 1024

const texto = (b: Uint8Array, inicio: number, fim: number) => String.fromCharCode(...b.subarray(inicio, fim))
const MARCAS_HEIC = ['heic', 'heix', 'mif1', 'msf1']
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const TIPOS = [
  { mime: 'application/pdf', extensao: '.pdf', confere: (b: Uint8Array) => texto(b, 0, 5) === '%PDF-' },
  { mime: 'image/jpeg', extensao: '.jpg', confere: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', extensao: '.png', confere: (b: Uint8Array) => PNG.every((x, i) => b[i] === x) },
  {
    mime: 'image/webp',
    extensao: '.webp',
    confere: (b: Uint8Array) => texto(b, 0, 4) === 'RIFF' && texto(b, 8, 12) === 'WEBP',
  },
  {
    mime: 'image/heic',
    extensao: '.heic',
    confere: (b: Uint8Array) => texto(b, 4, 8) === 'ftyp' && MARCAS_HEIC.includes(texto(b, 8, 12)),
  },
]

/** Tipo real pelo conteúdo (o Content-Type do navegador é ignorado, como no back-end). */
export const detectarTipo = (b: Uint8Array) => (b.length < 12 ? undefined : TIPOS.find((t) => t.confere(b)))

export type Parte = { campo: string; nomeArquivo: string | null; bytes: Uint8Array<ArrayBuffer> }

/**
 * Lê o corpo multipart à mão. `request.formData()` falha nos testes (jsdom + undici), e este
 * caminho funciona igual no navegador.
 */
export async function lerMultipart(request: Request): Promise<Parte[]> {
  const fronteira = request.headers.get('content-type')?.match(/boundary=(?:"([^"]+)"|([^;]+))/)
  if (!fronteira) return []
  const separador = `--${fronteira[1] ?? fronteira[2]}`
  const bytes = new Uint8Array(await request.arrayBuffer())
  // latin1: um caractere por byte, então as posições no texto são as mesmas dos bytes.
  const corpo = new TextDecoder('latin1').decode(bytes)
  const partes: Parte[] = []
  let inicio = corpo.indexOf(separador)
  while (inicio >= 0) {
    const proximo = corpo.indexOf(separador, inicio + separador.length)
    if (proximo < 0) break
    const fimCabecalho = corpo.indexOf('\r\n\r\n', inicio)
    if (fimCabecalho > 0 && fimCabecalho < proximo) {
      const cabecalho = new TextDecoder().decode(bytes.subarray(inicio + separador.length, fimCabecalho))
      partes.push({
        campo: cabecalho.match(/name="([^"]*)"/)?.[1] ?? '',
        nomeArquivo: cabecalho.match(/filename="([^"]*)"/)?.[1] ?? null,
        bytes: bytes.slice(fimCabecalho + 4, proximo - 2),
      })
    }
    inicio = proximo
  }
  return partes
}

/** Nome exibido no download: sem pastas, sem caracteres de controle, com tamanho limitado. */
export function nomeSeguro(original: string, extensao: string) {
  // oxlint-disable-next-line no-control-regex -- remover caracteres de controle é o objetivo
  const nome = (original.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200)
  return nome || `anexo${extensao}`
}

/**
 * O que o multer confere antes de tudo (tamanho e campo). Devolve a resposta de erro, ou o
 * arquivo (ausente se não veio nenhum).
 */
export async function lerUpload(request: Request): Promise<{ problema: Response } | { arquivo: Parte | undefined }> {
  const arquivos = (await lerMultipart(request)).filter((p) => p.nomeArquivo !== null)
  if (arquivos.some((p) => p.bytes.byteLength > TAMANHO_MAXIMO))
    return { problema: erro(413, 'ARQUIVO_GRANDE_DEMAIS', 'O arquivo pode ter no máximo 10 MB.') }
  if (arquivos.length > 1 || arquivos.some((p) => p.campo !== 'arquivo'))
    return { problema: erro(400, 'UPLOAD_INVALIDO', 'Envie um único arquivo no campo "arquivo".') }
  return { arquivo: arquivos[0] }
}

export const tipoNaoAceito = () =>
  erro(415, 'TIPO_NAO_SUPORTADO', 'Tipo de arquivo não aceito. Envie PDF ou imagem (JPG, PNG, WEBP, HEIC).')

/** Resposta de download com o nome original (como res.attachment do Express). */
export const respostaArquivo = (a: { bytes: Uint8Array<ArrayBuffer>; mimeType: string; nomeOriginal: string }) =>
  new Response(a.bytes, {
    headers: {
      'Content-Type': a.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.nomeOriginal)}`,
    },
  })
