// Consultas e mutações de remédios.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { invalidarPainel } from './hoje'
import { agora, paraDataHoraISO } from '@/lib/datas'
import type { DoseDoDia, Medicamento, MedicamentoCorpo, SituacaoDose } from '@/lib/tipos'

export const chavesRemedios = {
  todos: ['medicamentos'] as const,
  lista: ['medicamentos', 'lista'] as const,
  item: (id: string) => ['medicamentos', 'item', id] as const,
  doDia: (data: string) => ['medicamentos', 'dia', data] as const,
}

export const useMedicamentos = () =>
  useQuery({ queryKey: chavesRemedios.lista, queryFn: () => api<Medicamento[]>('/medicamentos') })

export const useMedicamento = (id: string | undefined) =>
  useQuery({
    queryKey: chavesRemedios.item(id ?? ''),
    queryFn: () => api<Medicamento>(`/medicamentos/${id}`),
    enabled: Boolean(id),
  })

export const useDosesDoDia = (data: string) =>
  useQuery({
    queryKey: chavesRemedios.doDia(data),
    queryFn: () => api<DoseDoDia[]>('/medicamentos/hoje', { query: { data } }),
  })

/**
 * Marca a dose como tomada, não tomada ou pendente (desfaz). Atualiza a tela na hora (a pessoa vê
 * o resultado sem esperar a rede) e desfaz se o servidor recusar.
 */
export function useRegistrarDose(data: string) {
  const cliente = useQueryClient()
  const chave = chavesRemedios.doDia(data)
  // A tela Hoje mostra a mesma dose: ela é buscada de novo (onSettled).
  const trocar = (horarioId: string, mudar: (d: DoseDoDia) => DoseDoDia) =>
    cliente.setQueryData<DoseDoDia[]>(
      chave,
      (lista) => lista && lista.map((d) => (d.horarioId === horarioId ? mudar(d) : d)),
    )

  return useMutation({
    mutationFn: ({ horarioId, situacao }: { horarioId: string; situacao: SituacaoDose }) =>
      api<DoseDoDia>('/medicamentos/registros', { method: 'POST', corpo: { horarioId, data, situacao } }),
    onMutate: async ({ horarioId, situacao }) => {
      await cliente.cancelQueries({ queryKey: chave })
      const anterior = cliente.getQueryData<DoseDoDia[]>(chave)
      const tomado = situacao === 'tomado'
      trocar(horarioId, (d) => ({ ...d, situacao, tomado, tomadoEm: tomado ? paraDataHoraISO(agora()) : null }))
      return { anterior }
    },
    onError: (_erro, _vars, contexto) => cliente.setQueryData(chave, contexto?.anterior),
    onSuccess: (atualizado) => trocar(atualizado.horarioId, () => atualizado),
    // O resumo do painel (pendentes) vem do servidor.
    onSettled: () => invalidarPainel(cliente),
  })
}

function useInvalidarRemedios() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([cliente.invalidateQueries({ queryKey: chavesRemedios.todos }), invalidarPainel(cliente)])
}

export function useSalvarMedicamento() {
  const cliente = useQueryClient()
  const invalidar = useInvalidarRemedios()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: MedicamentoCorpo }) =>
      id
        ? api<Medicamento>(`/medicamentos/${id}`, { method: 'PUT', corpo: dados })
        : api<Medicamento>('/medicamentos', { method: 'POST', corpo: dados }),
    meta: { semAviso: true },
    onSuccess: (salvo) => {
      // A lista em cache já mostra o resultado ao voltar (sem esperar a nova busca).
      cliente.setQueryData<Medicamento[]>(
        chavesRemedios.lista,
        (lista) =>
          lista &&
          (lista.some((m) => m.id === salvo.id)
            ? lista.map((m) => (m.id === salvo.id ? salvo : m))
            : [...lista, salvo]),
      )
      return invalidar()
    },
  })
}

export function useExcluirMedicamento() {
  const cliente = useQueryClient()
  const invalidar = useInvalidarRemedios()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/medicamentos/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      // Sai do cache antes de recarregar, para a tela ainda aberta não buscar de novo (404).
      cliente.removeQueries({ queryKey: chavesRemedios.item(id) })
      cliente.setQueryData<Medicamento[]>(chavesRemedios.lista, (lista) => lista?.filter((m) => m.id !== id))
      return invalidar()
    },
  })
}
