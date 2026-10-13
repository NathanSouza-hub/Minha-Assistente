import type { LucideIcon } from 'lucide-react'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'

// Página provisória das áreas ainda não construídas (ver "Entregas" no prompt do front).
export function EmBreve({ titulo, icone, descricao }: { titulo: string; icone: LucideIcon; descricao: string }) {
  return (
    <Pagina titulo={titulo}>
      <EstadoVazio icone={icone} titulo="Em construção">
        {descricao}
      </EstadoVazio>
    </Pagina>
  )
}
