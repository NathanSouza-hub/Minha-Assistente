import {
  BellSimpleRingingIcon,
  CalendarDotsIcon,
  CaretRightIcon,
  PillIcon,
  PlusIcon,
  ReceiptIcon,
  RepeatIcon,
  type Icon,
} from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

/** Cada atividade nova nasce no módulo dela (não há cadastro paralelo de "atividade"). */
const OPCOES: { rota: string; titulo: string; texto: string; icone: Icon; area: string }[] = [
  {
    rota: '/tarefas/nova',
    titulo: 'Lembrete',
    texto: 'Algo para fazer num dia, como ler e-mails',
    icone: BellSimpleRingingIcon,
    area: 'tarefas',
  },
  { rota: '/rotina/nova', titulo: 'Lembrete que repete', texto: 'Toda semana ou em alguns dias', icone: RepeatIcon, area: 'compromissos' },
  { rota: '/agenda/novo', titulo: 'Agendamento', texto: 'Reunião, consulta, gravação, viagem...', icone: CalendarDotsIcon, area: 'agenda' },
  { rota: '/pagamentos/novo', titulo: 'Conta a pagar', texto: 'Com vencimento e valor', icone: ReceiptIcon, area: 'contas' },
  { rota: '/remedios/novo', titulo: 'Medicamento', texto: 'Com os horários das doses', icone: PillIcon, area: 'remedios' },
]

/** Botão "Nova" do Início: escolhe o que cadastrar e abre o formulário do módulo certo. */
export function NovaAtividade() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="lg">
          <PlusIcon weight="bold" aria-hidden />
          Nova
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-w-xl rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="text-xl font-bold">O que você quer cadastrar?</SheetTitle>
        <SheetDescription className="sr-only">Escolha o tipo de atividade.</SheetDescription>
        <ul className="flex flex-col divide-y divide-linha">
          {OPCOES.map(({ rota, titulo, texto, icone: Icone, area }) => (
            <li key={rota} className={`area-${area}`}>
              <SheetClose asChild>
                <Link to={rota} className="-mx-2 flex min-h-16 items-center gap-4 rounded-lg px-2 py-2 hover:bg-suave/60">
                  <span className="selo-area size-11" aria-hidden>
                    <Icone className="size-6" weight="fill" />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-lg font-semibold">{titulo}</span>
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
