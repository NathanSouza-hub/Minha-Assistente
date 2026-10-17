import { toast } from 'sonner'
import { useEditarPagamentoPorId, usePagarPagamento } from '@/consultas/pagamentos'
import type { Pagamento } from '@/lib/tipos'
import { paraEdicao } from './formulario'

/** Volta a conta paga para pendente (a fatura do cartão não volta: ela vem das compras). */
export function useDesfazerPagamento() {
  const editar = useEditarPagamentoPorId()
  return {
    desfazer: (p: Pagamento) =>
      editar.mutate({ id: p.id, dados: { ...paraEdicao(p), status: 'pendente', dataPagamento: null } }),
    desfazendo: editar.isPending,
  }
}

/** Marca como pago e avisa com "Desfazer" (usado no cartão da conta e na tabela de contas). */
export function useMarcarComoPago() {
  const pagar = usePagarPagamento()
  const { desfazer } = useDesfazerPagamento()

  function marcar(p: Pagamento, valorCentavos?: number, aoPagar?: () => void) {
    // mutateAsync: com o filtro "A pagar" a linha some ao pagar, e o onSuccess do mutate não rodaria.
    // O erro já vira aviso em src/app/consultas.ts.
    pagar.mutateAsync({ id: p.id, valorCentavos }).then(
      () => {
        aoPagar?.()
        toast.success(`${p.descricao} marcado como pago.`, {
          description: p.recorrencia !== 'nenhuma' ? 'A conta do próximo período já foi criada.' : undefined,
          action: p.cartaoId ? undefined : { label: 'Desfazer', onClick: () => desfazer(p) },
        })
      },
      () => {},
    )
  }

  return { marcar, marcando: pagar.isPending }
}
