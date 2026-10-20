import { Link } from 'react-router'
import { SignpostIcon } from '@phosphor-icons/react'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { Button } from '@/components/ui/button'

export function NaoEncontrada() {
  return (
    <Pagina titulo="Página não encontrada">
      <EstadoVazio
        icone={SignpostIcon}
        titulo="Este endereço não existe"
        acao={
          <Button asChild size="lg">
            <Link to="/">Voltar para o início</Link>
          </Button>
        }
      >
        O link pode estar errado ou a página foi removida.
      </EstadoVazio>
    </Pagina>
  )
}
