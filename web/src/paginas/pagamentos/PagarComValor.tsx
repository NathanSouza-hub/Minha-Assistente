import { useState, type FormEvent } from 'react'
import { CheckCircleIcon } from '@phosphor-icons/react'
import { Campo } from '@/components/Campo'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { paraCentavos } from '@/lib/dinheiro'
import type { Pagamento } from '@/lib/tipos'

/** Conta da equipe com valor a definir: pede o valor pago antes de marcar. */
export function PagarComValor({
  pagamento: p,
  enviando,
  aoConfirmar,
  aoFechar,
}: {
  pagamento: Pagamento
  enviando: boolean
  aoConfirmar: (centavos: number) => void
  aoFechar: () => void
}) {
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState<string>()

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const centavos = paraCentavos(valor)
    if (!centavos) return setErro('Digite o valor pago, por exemplo 1.500,00.')
    setErro(undefined)
    aoConfirmar(centavos)
  }

  return (
    <AlertDialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pagar {p.descricao}</AlertDialogTitle>
          <AlertDialogDescription>Informe quanto foi pago.</AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Campo
            rotulo={`Valor pago a ${p.descricao}`}
            prefixo="R$"
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            erro={erro}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Voltar
            </Button>
            <Button type="submit" disabled={enviando}>
              <CheckCircleIcon aria-hidden />
              {enviando ? 'Marcando…' : 'Confirmar pagamento'}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
