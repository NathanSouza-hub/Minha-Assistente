// WhatsApp da conta (decisão 38): situação, código para ligar o número e desligar.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { CodigoWhatsapp, SituacaoWhatsapp } from '@/lib/tipos'

export const chavesWhatsapp = { situacao: ['whatsapp'] as const }

/**
 * Com um código na tela, relê a cada 3 s até o número aparecer ligado (a pessoa manda o código pelo
 * WhatsApp e volta). Também relê ao voltar para o app.
 */
export const useSituacaoWhatsapp = (aguardando = false) =>
  useQuery({
    queryKey: chavesWhatsapp.situacao,
    queryFn: () => api<SituacaoWhatsapp>('/whatsapp'),
    refetchOnWindowFocus: 'always',
    refetchInterval: (consulta) => (aguardando && !consulta.state.data?.vinculado ? 3000 : false),
  })

export const useGerarCodigoWhatsapp = () =>
  useMutation({ mutationFn: () => api<CodigoWhatsapp>('/whatsapp/codigo', { method: 'POST' }) })

export function useDesvincularWhatsapp() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/whatsapp', { method: 'DELETE' }),
    onSuccess: () => {
      cliente.setQueryData<SituacaoWhatsapp>(chavesWhatsapp.situacao, (antes) =>
        antes && { ...antes, vinculado: false, telefone: null, vinculadoEm: null },
      )
      toast.success('WhatsApp desligado da sua conta.')
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: chavesWhatsapp.situacao }),
  })
}
