// Estado das notificações deste aparelho e as ações (ativar, desligar, testar, convidar).
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { ativar, desativar, jaConvidou, lerEstado, marcarConvidado, type EstadoPush } from '@/lib/notificacoes'

export const chavesNotificacoes = { estado: ['notificacoes', 'estado'] as const }

/** Relido ao voltar para o app: a permissão pode ter mudado nas configurações do aparelho. */
export const useEstadoNotificacoes = () =>
  useQuery({
    queryKey: chavesNotificacoes.estado,
    queryFn: lerEstado,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
  })

const avisoDoEstado: Partial<Record<EstadoPush, () => void>> = {
  ligado: () => toast.success('Notificações ligadas neste aparelho.'),
  bloqueado: () =>
    toast.error('As notificações foram bloqueadas.', {
      description: 'Para receber os lembretes, libere nas configurações do navegador.',
    }),
  indisponivel: () =>
    toast.error('As notificações ainda não estão prontas neste aparelho.', {
      description: 'Recarregue a página e tente de novo.',
    }),
}

function aoAtivar(cliente: QueryClient, estado: EstadoPush) {
  cliente.setQueryData(chavesNotificacoes.estado, estado)
  avisoDoEstado[estado]?.()
}

export function useAtivarNotificacoes() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ativar,
    onSuccess: (estado) => aoAtivar(cliente, estado),
    // Se falhou no meio (ex.: servidor fora), o aparelho pode ter ficado inscrito só no navegador.
    onSettled: () => cliente.invalidateQueries({ queryKey: chavesNotificacoes.estado }),
  })
}

export function useDesativarNotificacoes() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: () => desativar(),
    onSuccess: (estado) => {
      cliente.setQueryData(chavesNotificacoes.estado, estado)
      toast.success('Notificações desligadas neste aparelho.')
    },
  })
}

export const useTestarNotificacao = () =>
  useMutation({
    mutationFn: () => api<void>('/notificacoes/teste', { method: 'POST' }),
    onSuccess: () =>
      toast.success('Notificação enviada.', { description: 'Ela deve aparecer em alguns segundos.' }),
  })

/**
 * Convida a ligar as notificações logo depois de a pessoa criar algo com lembrete — nunca ao
 * abrir o app. Uma vez por aparelho; quem quiser depois encontra em Mais → Notificações.
 */
export function useConvidarNotificacoes() {
  const cliente = useQueryClient()
  const navegar = useNavigate()

  // O aviso fica na tela depois de o formulário que convidou sair (ele navega ao salvar): a ação
  // não pode depender de uma mutation desse componente.
  const ativarPeloAviso = () =>
    ativar()
      .then((estado) => aoAtivar(cliente, estado))
      .catch((erro) =>
        toast.error(erro instanceof ApiError ? erro.message : 'Não foi possível ativar as notificações.'),
      )
      .finally(() => cliente.invalidateQueries({ queryKey: chavesNotificacoes.estado }))

  return async function convidar() {
    if (jaConvidou()) return
    const estado = await lerEstado()
    if (estado === 'desligado') {
      marcarConvidado()
      toast('Quer receber os lembretes neste aparelho?', {
        id: 'convite-notificacoes',
        description: 'Avisamos na hora dos agendamentos, remédios, compromissos e contas.',
        duration: 20_000,
        // O clique aqui é o "toque da pessoa" que o navegador exige para pedir a permissão.
        action: { label: 'Ativar', onClick: () => void ativarPeloAviso() },
        cancel: { label: 'Agora não', onClick: () => {} },
      })
    } else if (estado === 'instalar-iphone') {
      marcarConvidado()
      toast('Para receber os lembretes no iPhone, instale o app.', {
        id: 'convite-notificacoes',
        duration: 20_000,
        action: { label: 'Ver como', onClick: () => navegar('/notificacoes') },
      })
    }
  }
}
