import { useState } from 'react'
import { ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { temDadosNaoSalvos } from '@/lib/formularios'

const UMA_HORA = 60 * 60 * 1000

/**
 * Procura versão nova de hora em hora e sempre que o app volta para a frente: no celular o PWA
 * fica dias aberto em segundo plano, sem a navegação que faria o navegador procurar sozinho.
 */
function procurarVersaoNova(registro: ServiceWorkerRegistration) {
  const procurar = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) registro.update().catch(() => {})
  }
  setInterval(procurar, UMA_HORA)
  document.addEventListener('visibilitychange', procurar)
}

/**
 * Aviso de versão nova do app. O worker novo fica esperando (registerType 'prompt' no
 * vite.config.ts) até a pessoa tocar em "Atualizar"; só então assume e a página recarrega. Se há
 * formulário com algo digitado, pergunta antes, porque recarregar perde o que não foi salvo.
 */
export function AvisoAtualizacao() {
  const {
    needRefresh: [temVersaoNova, definirTemVersaoNova],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registro) => registro && procurarVersaoNova(registro),
  })
  const [confirmando, definirConfirmando] = useState(false)

  if (!temVersaoNova) return null

  const atualizar = () => void updateServiceWorker(true)
  const pedirAtualizacao = () => (temDadosNaoSalvos() ? definirConfirmando(true) : atualizar())

  return (
    <>
      <section
        role="status"
        aria-label="Nova versão do app"
        className="superficie fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md flex-col gap-3 p-4 ring-1 ring-primary/20 md:inset-x-auto md:right-6 md:bottom-6"
      >
        <div className="flex items-start gap-3">
          <ArrowsClockwiseIcon className="mt-0.5 size-7 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-bold">Nova versão do app disponível</p>
            <p className="text-muted-foreground">Toque em Atualizar para usar a versão mais recente.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => definirTemVersaoNova(false)}>
            Depois
          </Button>
          <Button onClick={pedirAtualizacao}>Atualizar</Button>
        </div>
      </section>

      <AlertDialog open={confirmando} onOpenChange={definirConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar agora?</AlertDialogTitle>
            <AlertDialogDescription>
              Há um formulário com dados ainda não salvos nesta tela. Ao atualizar, o que foi digitado e
              não salvo será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar preenchendo</AlertDialogCancel>
            <AlertDialogAction variant="perigo" onClick={atualizar}>
              Atualizar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
