import {
  AirplaneTiltIcon,
  BarbellIcon,
  CalendarDotsIcon,
  CaretRightIcon,
  FirstAidKitIcon,
  FlaskIcon,
  PersonSimpleWalkIcon,
  PlusIcon,
  RadioIcon,
  type Icon,
} from '@phosphor-icons/react'
import { Link } from 'react-router'
import type { Area } from '@/app/navegacao'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type Opcao = { titulo: string; texto: string; icone: Icon; area: Area; rota: (data: string) => string }

const evento = (tipo?: string) => (data: string) => {
  const busca = new URLSearchParams()
  if (tipo) busca.set('tipo', tipo)
  if (data) busca.set('data', data)
  const texto = busca.toString()
  return `/agenda/novo${texto ? `?${texto}` : ''}`
}

/** As 7 opções do "+" (decisão 34): cada uma abre um formulário com as perguntas dela (perfis.ts). */
const OPCOES: Opcao[] = [
  { titulo: 'Compromissos e eventos', texto: 'Reunião, gravação, entrevista...', icone: CalendarDotsIcon, area: 'agenda', rota: evento() },
  { titulo: 'Consultas', texto: 'Especialidade, profissional e local', icone: FirstAidKitIcon, area: 'remedios', rota: evento('consulta') },
  { titulo: 'Exames', texto: 'Tipo de exame, local e orientações', icone: FlaskIcon, area: 'remedios', rota: evento('exame') },
  { titulo: 'Fisioterapia', texto: 'Profissional, local e sessões', icone: PersonSimpleWalkIcon, area: 'fisioterapia', rota: evento('fisioterapia') },
  { titulo: 'Atividades físicas', texto: 'Atividade, local e frequência', icone: BarbellIcon, area: 'atividade', rota: evento('atividade_fisica') },
  { titulo: 'Viagens', texto: 'Destino, datas, hospedagem e passagens', icone: AirplaneTiltIcon, area: 'viagens', rota: () => '/viagens/nova' },
  { titulo: 'Programas de rádio', texto: 'Emissora, programa e frequência', icone: RadioIcon, area: 'radio', rota: evento('programa_radio') },
]

/** O único botão de cadastro da Agenda. `data`: o dia escolhido no calendário (vazio = hoje). */
export function NovoNaAgenda({ data = '' }: { data?: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary">
          <PlusIcon weight="bold" aria-hidden />
          Novo
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-h-[90dvh] max-w-xl overflow-y-auto rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="text-secao font-bold">O que você quer agendar?</SheetTitle>
        <SheetDescription className="sr-only">Escolha o tipo de cadastro.</SheetDescription>
        <ul className="flex flex-col divide-y divide-linha" aria-label="Tipos de cadastro">
          {OPCOES.map(({ titulo, texto, icone: Icone, area, rota }) => (
            <li key={titulo} className={`area-${area}`}>
              <SheetClose asChild>
                <Link to={rota(data)} className="-mx-2 flex min-h-16 items-center gap-4 rounded-lg px-2 py-2 hover:bg-suave/60">
                  <span className="selo-area size-11" aria-hidden>
                    <Icone className="size-6" weight="fill" />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">{titulo}</span>
                    <span className="text-base text-muted-foreground">{texto}</span>
                  </span>
                  <CaretRightIcon weight="bold" className="size-5 text-muted-foreground" aria-hidden />
                </Link>
              </SheetClose>
            </li>
          ))}
        </ul>
        <SheetClose asChild>
          <Button variant="outline" size="lg">
            Fechar
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  )
}
