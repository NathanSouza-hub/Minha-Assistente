// Mesmas regras de produtividade() em src/modules/relatorios/service.js: conta o que foi concluído,
// pelo dia da conclusão (fuso de São Paulo); todo dia do período vem, com zeros.
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/lib/api'
import { deDataHoraISO, deDataISO } from '@/lib/datas'
import type { Concluidos, RelatorioProdutividade } from '@/lib/tipos'
import { banco } from './banco'
import { autenticado, erro } from './util'

const MAX_DIAS = 366
const somar = (lista: Concluidos[]): Concluidos => {
  const tarefas = lista.reduce((s, d) => s + d.tarefas, 0)
  const compromissos = lista.reduce((s, d) => s + d.compromissos, 0)
  return { tarefas, compromissos, total: tarefas + compromissos }
}

export const handlersProdutividade = [
  http.get(
    `${API_URL}/relatorios/produtividade`,
    autenticado(({ request }, u) => {
      const q = new URL(request.url).searchParams
      const inicio = q.get('inicio') ?? ''
      const fim = q.get('fim') ?? ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim))
        return erro(400, 'VALIDACAO', 'inicio: Data inválida: use o formato AAAA-MM-DD.')
      if (inicio > fim) return erro(400, 'VALIDACAO', 'fim: O início precisa ser anterior ou igual ao fim.')
      if (deDataISO(fim).diff(deDataISO(inicio), 'days').days + 1 > MAX_DIAS)
        return erro(400, 'VALIDACAO', `fim: O período pode ter no máximo ${MAX_DIAS} dias.`)

      // Agrupa uma vez por dia (como o GROUP BY do back-end), sem varrer as listas a cada dia.
      const contar = (instantes: string[]) => {
        const porDia = new Map<string, number>()
        for (const i of instantes) {
          const dia = deDataHoraISO(i).toISODate()!
          porDia.set(dia, (porDia.get(dia) ?? 0) + 1)
        }
        return porDia
      }
      const tarefas = contar(banco.tarefas.filter((t) => t.usuarioId === u.id && t.concluidaEm).map((t) => t.concluidaEm!))
      const rotinas = new Set(banco.rotinas.filter((r) => r.usuarioId === u.id).map((r) => r.id))
      const compromissos = contar(banco.conclusoesRotina.filter((c) => rotinas.has(c.rotinaId)).map((c) => c.concluidaEm))

      const dias: RelatorioProdutividade['dias'] = []
      for (let d = deDataISO(inicio); d <= deDataISO(fim); d = d.plus({ days: 1 })) {
        const data = d.toISODate()!
        const t = tarefas.get(data) ?? 0
        const c = compromissos.get(data) ?? 0
        dias.push({ data, tarefas: t, compromissos: c, total: t + c })
      }
      const semanas: { dias: typeof dias }[] = []
      for (const dia of dias) {
        const atual = semanas.at(-1)
        if (atual && deDataISO(dia.data).weekday !== 1) atual.dias.push(dia)
        else semanas.push({ dias: [dia] })
      }
      return HttpResponse.json<RelatorioProdutividade>({
        inicio,
        fim,
        total: somar(dias),
        dias,
        semanas: semanas.map((s) => ({ inicio: s.dias[0].data, fim: s.dias.at(-1)!.data, ...somar(s.dias) })),
      })
    }),
  ),
]
