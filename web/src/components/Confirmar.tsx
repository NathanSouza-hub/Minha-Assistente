import type { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type Props = {
  /** Botão que abre a confirmação. */
  gatilho: ReactNode
  titulo: string
  descricao: ReactNode
  /** Texto do botão que executa, ex.: "Excluir pagamento" — o mesmo verbo da ação. */
  confirmar: string
  aoConfirmar: () => void
}

/** Confirmação antes de uma ação que não dá para desfazer (exclusões). */
export function Confirmar({ gatilho, titulo, descricao, confirmar, aoConfirmar }: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{gatilho}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction variant="perigo" onClick={aoConfirmar}>
            {confirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
