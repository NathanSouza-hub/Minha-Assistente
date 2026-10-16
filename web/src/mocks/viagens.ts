// Viagens e anexos — regras espelhando src/modules/viagens do back-end (etapa 9),
// src/middlewares/upload.js e src/lib/tipoArquivo.js.
import { http, HttpResponse } from 'msw'
import { DateTime } from 'luxon'
import { API_URL } from '@/lib/api'
import type { AnexoViagem, Viagem, ViagemCorpo } from '@/lib/tipos'
import { agoraISO, banco, type AnexoViagemMock, type ViagemMock } from './banco'
import { autenticado, erro, naoEncontrado } from './util'
import { detectarTipo, lerMultipart, nomeSeguro, TAMANHO_MAXIMO } from './arquivos'

const MAXIMO_ANEXOS = 20

const publicoAnexo = ({ id, nomeOriginal, mimeType, tamanhoBytes, criadoEm }: AnexoViagemMock): AnexoViagem => ({
  id,
  nomeOriginal,
  mimeType,
  tamanhoBytes,
  criadoEm,
})

const publico = ({ usuarioId: _u, ...v }: ViagemMock): Viagem => ({
  ...v,
  anexos: banco.anexosViagem.filter((a) => a.viagemId === v.id).map(publicoAnexo),
})

const doUsuario = (usuarioId: string, id: string) =>
  banco.viagens.find((v) => v.id === id && v.usuarioId === usuarioId)

const dataValida = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && DateTime.fromISO(v).isValid

function validar(c: Partial<ViagemCorpo>) {
  const problemas: string[] = []
  const destino = c.destino?.trim() ?? ''
  if (!destino) problemas.push('destino: Informe o destino.')
  else if (destino.length > 200) problemas.push('destino: Destino longo demais.')
  if (!dataValida(c.ida)) problemas.push('ida: Data inválida: use o formato AAAA-MM-DD.')
  if (c.volta && !dataValida(c.volta)) problemas.push('volta: Data inválida: use o formato AAAA-MM-DD.')
  for (const [campo, max] of [['hospedagem', 500], ['transporte', 500], ['observacoes', 2000]] as const) {
    if ((c[campo]?.trim().length ?? 0) > max) problemas.push(`${campo}: Use no máximo ${max} caracteres.`)
  }
  if (!problemas.length && c.volta && c.volta < c.ida!)
    problemas.push('volta: A volta precisa ser no mesmo dia ou depois da ida.')
  return problemas.length ? erro(400, 'VALIDACAO', problemas.join('; ')) : null
}

const gravaveis = (c: ViagemCorpo) => ({
  destino: c.destino.trim(),
  ida: c.ida,
  volta: c.volta || null,
  hospedagem: c.hospedagem?.trim() || null,
  transporte: c.transporte?.trim() || null,
  observacoes: c.observacoes?.trim() || null,
})

export const handlersViagens = [
  http.get(
    `${API_URL}/viagens`,
    autenticado((_ctx, u) =>
      HttpResponse.json(
        banco.viagens
          .filter((v) => v.usuarioId === u.id)
          .sort((a, b) => b.ida.localeCompare(a.ida))
          .map(publico),
      ),
    ),
  ),

  http.post(
    `${API_URL}/viagens`,
    autenticado(async ({ request }, u) => {
      const corpo = (await request.json()) as ViagemCorpo
      const invalido = validar(corpo)
      if (invalido) return invalido
      const agora = agoraISO()
      const viagem: ViagemMock = {
        id: crypto.randomUUID(),
        usuarioId: u.id,
        ...gravaveis(corpo),
        criadoEm: agora,
        atualizadoEm: agora,
      }
      banco.viagens.push(viagem)
      return HttpResponse.json(publico(viagem), { status: 201 })
    }),
  ),

  http.get(
    `${API_URL}/viagens/:id`,
    autenticado(({ params }, u) => {
      const v = doUsuario(u.id, String(params.id))
      return v ? HttpResponse.json(publico(v)) : naoEncontrado('Viagem', { feminino: true })
    }),
  ),

  http.put(
    `${API_URL}/viagens/:id`,
    autenticado(async ({ request, params }, u) => {
      const v = doUsuario(u.id, String(params.id))
      if (!v) return naoEncontrado('Viagem', { feminino: true })
      const corpo = (await request.json()) as ViagemCorpo
      const invalido = validar(corpo)
      if (invalido) return invalido
      Object.assign(v, gravaveis(corpo), { atualizadoEm: agoraISO() })
      return HttpResponse.json(publico(v))
    }),
  ),

  http.delete(
    `${API_URL}/viagens/:id`,
    autenticado(({ params }, u) => {
      const v = doUsuario(u.id, String(params.id))
      if (!v) return naoEncontrado('Viagem', { feminino: true })
      banco.viagens.splice(banco.viagens.indexOf(v), 1)
      banco.anexosViagem = banco.anexosViagem.filter((a) => a.viagemId !== v.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.post(
    `${API_URL}/viagens/:id/anexos`,
    autenticado(async ({ request, params }, u) => {
      // O multer lê o arquivo antes de tudo: tamanho e campo errado vêm primeiro.
      const partes = await lerMultipart(request)
      const arquivos = partes.filter((p) => p.nomeArquivo !== null)
      if (arquivos.some((p) => p.bytes.byteLength > TAMANHO_MAXIMO))
        return erro(413, 'ARQUIVO_GRANDE_DEMAIS', 'O arquivo pode ter no máximo 10 MB.')
      if (arquivos.length > 1 || arquivos.some((p) => p.campo !== 'arquivo'))
        return erro(400, 'UPLOAD_INVALIDO', 'Envie um único arquivo no campo "arquivo".')

      const v = doUsuario(u.id, String(params.id))
      if (!v) return naoEncontrado('Viagem', { feminino: true })
      const [arquivo] = arquivos
      if (!arquivo) return erro(400, 'VALIDACAO', 'arquivo: envie o arquivo no campo "arquivo".')

      const tipo = detectarTipo(arquivo.bytes)
      if (!tipo)
        return erro(
          415,
          'TIPO_NAO_SUPORTADO',
          'Tipo de arquivo não aceito. Envie PDF ou imagem (JPG, PNG, WEBP, HEIC).',
        )
      if (banco.anexosViagem.filter((a) => a.viagemId === v.id).length >= MAXIMO_ANEXOS)
        return erro(409, 'LIMITE_ANEXOS', `Cada viagem pode ter no máximo ${MAXIMO_ANEXOS} anexos.`)

      const anexo: AnexoViagemMock = {
        id: crypto.randomUUID(),
        viagemId: v.id,
        nomeOriginal: nomeSeguro(arquivo.nomeArquivo ?? '', tipo.extensao),
        mimeType: tipo.mime,
        tamanhoBytes: arquivo.bytes.byteLength,
        bytes: arquivo.bytes,
        criadoEm: agoraISO(),
      }
      banco.anexosViagem.push(anexo)
      return HttpResponse.json(publicoAnexo(anexo), { status: 201 })
    }),
  ),

  http.get(
    `${API_URL}/viagens/:id/anexos/:anexoId`,
    autenticado(({ params }, u) => {
      const v = doUsuario(u.id, String(params.id))
      const anexo = v && banco.anexosViagem.find((a) => a.id === params.anexoId && a.viagemId === v.id)
      if (!anexo) return naoEncontrado('Anexo')
      return new HttpResponse(anexo.bytes, {
        headers: {
          'Content-Type': anexo.mimeType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(anexo.nomeOriginal)}`,
        },
      })
    }),
  ),

  http.delete(
    `${API_URL}/viagens/:id/anexos/:anexoId`,
    autenticado(({ params }, u) => {
      const v = doUsuario(u.id, String(params.id))
      const indice = v ? banco.anexosViagem.findIndex((a) => a.id === params.anexoId && a.viagemId === v.id) : -1
      if (indice < 0) return naoEncontrado('Anexo')
      banco.anexosViagem.splice(indice, 1)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
