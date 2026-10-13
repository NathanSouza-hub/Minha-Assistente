import { Sun } from 'lucide-react'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { agora } from '@/lib/datas'

function CabecalhoHoje() {
  const hoje = agora()
  return (
    <div className="relative pl-5">
      {/* Fita açafrão: o marcador de página da agenda, preso no dia de hoje. */}
      <span aria-hidden className="absolute top-1 bottom-1 left-0 w-1.5 rounded-full bg-hoje" />
      <h1 className="flex flex-col">
        <span className="text-xl font-semibold text-muted-foreground first-letter:uppercase">
          {hoje.toFormat('cccc')}
        </span>
        <span className="text-[2.75rem] leading-[1.05] font-bold tracking-tight text-primary md:text-6xl">
          {hoje.toFormat("d 'de' LLLL")}
        </span>
      </h1>
    </div>
  )
}

export function Hoje() {
  return (
    <Pagina titulo="Hoje" cabecalho={<CabecalhoHoje />}>
      <EstadoVazio icone={Sun} titulo="Seu dia aparece aqui">
        Compromissos, remédios, tarefas da rotina e contas a pagar de hoje, tudo numa tela só.
      </EstadoVazio>
    </Pagina>
  )
}
