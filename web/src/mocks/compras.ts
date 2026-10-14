// Lista de compras — regras espelhando src/modules/compras do back-end (etapa 10).
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { ordenarCompras } from '@/lib/compras'
import type { ItemCompra, ItemCompraCorpo } from '@/lib/tipos'
import { agoraISO, banco, type ItemCompraMock } from './banco'
import { autenticado, erro, naoEncontrado } from './util'

const publico = ({ usuarioId: _u, ...i }: ItemCompraMock): ItemCompra => i

const doUsuario = (usuarioId: string, id: string) =>
  banco.compras.find((i) => i.id === id && i.usuarioId === usuarioId)

function validar(c: Partial<ItemCompraCorpo>) {
  const problemas: string[] = []
  const nome = c.nome?.trim() ?? ''
  if (!nome) problemas.push('nome: Informe o item.')
  else if (nome.length > 120) problemas.push('nome: Nome longo demais.')
  for (const campo of ['categoria', 'quantidade'] as const) {
    if ((c[campo]?.trim().length ?? 0) > 60) problemas.push(`${campo}: Use no máximo 60 caracteres.`)
  }
  return problemas.length ? erro(400, 'VALIDACAO', problemas.join('; ')) : null
}

const gravaveis = (c: ItemCompraCorpo) => ({
  nome: c.nome.trim(),
  categoria: c.categoria?.trim() || null,
  quantidade: c.quantidade?.trim() || null,
})

export const handlersCompras = [
  http.get(
    `${API_URL}/compras`,
    autenticado(({ request }, u) => {
      const filtro = new URL(request.url).searchParams.get('comprado')
      if (filtro !== null && filtro !== 'true' && filtro !== 'false')
        return erro(400, 'VALIDACAO', 'comprado: Opção inválida: use "true" ou "false".')
      const itens = banco.compras.filter(
        (i) => i.usuarioId === u.id && (filtro === null || i.comprado === (filtro === 'true')),
      )
      return HttpResponse.json(ordenarCompras(itens).map(publico))
    }),
  ),

  http.post(
    `${API_URL}/compras`,
    autenticado(async ({ request }, u) => {
      const corpo = (await request.json()) as ItemCompraCorpo
      const invalido = validar(corpo)
      if (invalido) return invalido
      const agora = agoraISO()
      const item: ItemCompraMock = {
        id: crypto.randomUUID(),
        usuarioId: u.id,
        ...gravaveis(corpo),
        comprado: false,
        compradoEm: null,
        criadoEm: agora,
        atualizadoEm: agora,
      }
      banco.compras.push(item)
      return HttpResponse.json(publico(item), { status: 201 })
    }),
  ),

  http.put(
    `${API_URL}/compras/:id`,
    autenticado(async ({ request, params }, u) => {
      const item = doUsuario(u.id, String(params.id))
      if (!item) return naoEncontrado('Item')
      const corpo = (await request.json()) as ItemCompraCorpo
      const invalido = validar(corpo)
      if (invalido) return invalido
      // Editar não muda o status de comprado.
      Object.assign(item, gravaveis(corpo), { atualizadoEm: agoraISO() })
      return HttpResponse.json(publico(item))
    }),
  ),

  http.patch(
    `${API_URL}/compras/:id/comprado`,
    autenticado(async ({ request, params }, u) => {
      const item = doUsuario(u.id, String(params.id))
      if (!item) return naoEncontrado('Item')
      // Sem corpo marca como comprado; { comprado: false } desmarca.
      const { comprado = true } = (await request.json().catch(() => ({}))) as { comprado?: unknown }
      if (typeof comprado !== 'boolean') return erro(400, 'VALIDACAO', 'comprado: Informe true ou false.')
      const agora = agoraISO()
      Object.assign(item, { comprado, compradoEm: comprado ? agora : null, atualizadoEm: agora })
      return HttpResponse.json(publico(item))
    }),
  ),

  http.delete(
    `${API_URL}/compras/:id`,
    autenticado(({ params }, u) => {
      const item = doUsuario(u.id, String(params.id))
      if (!item) return naoEncontrado('Item')
      banco.compras.splice(banco.compras.indexOf(item), 1)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
