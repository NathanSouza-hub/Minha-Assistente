import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AvisoAtualizacao } from '@/components/AvisoAtualizacao'
import { acompanharFormularios } from '@/lib/formularios'
import { clienteConsultas } from '@/app/consultas'
import { ProvedorSessao } from '@/app/sessao'
import { rotas } from '@/app/rotas'
import './index.css'

async function iniciarMocks() {
  if (import.meta.env.VITE_API_MOCK !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledFrame: 'bypass' })
}

iniciarMocks().then(() => {
  acompanharFormularios()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={clienteConsultas}>
        <ProvedorSessao>
          <RouterProvider router={rotas} />
        </ProvedorSessao>
        <Toaster position="top-center" />
        <AvisoAtualizacao />
      </QueryClientProvider>
    </StrictMode>,
  )
})
