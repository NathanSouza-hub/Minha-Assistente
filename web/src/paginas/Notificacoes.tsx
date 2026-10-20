import { useState, type ReactNode } from 'react'
import {
  BellRingingIcon,
  BellSlashIcon,
  CalendarDotsIcon,
  CheckSquareIcon,
  ExportIcon,
  ListChecksIcon,
  PillIcon,
  PlusSquareIcon,
  WalletIcon,
  type Icon,
} from '@phosphor-icons/react'
import type { Area } from '@/app/navegacao'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  useAtivarNotificacoes,
  useAvisos,
  useDesativarNotificacoes,
  useEstadoNotificacoes,
  useResumo,
  useSalvarAvisos,
  useSalvarResumo,
  useTestarNotificacao,
} from '@/consultas/notificacoes'
import type { CategoriaAviso } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// Cada categoria no selo da sua área, para reconhecer de relance (o resumo tem seção própria).
const O_QUE_AVISA: { categoria: CategoriaAviso; icone: Icon; area: Area; titulo: string; texto: string }[] = [
  { categoria: 'agenda', icone: CalendarDotsIcon, area: 'agenda', titulo: 'Agendamentos', texto: 'Com a antecedência escolhida em cada um' },
  { categoria: 'remedios', icone: PillIcon, area: 'remedios', titulo: 'Remédios', texto: 'Na hora de cada dose' },
  { categoria: 'compromissos', icone: CheckSquareIcon, area: 'compromissos', titulo: 'Compromissos', texto: 'Os que têm lembrete, na hora marcada' },
  { categoria: 'tarefas', icone: ListChecksIcon, area: 'tarefas', titulo: 'Tarefas', texto: 'As que têm lembrete, na hora marcada' },
  { categoria: 'contas', icone: WalletIcon, area: 'contas', titulo: 'Contas a pagar', texto: 'Na véspera e no dia do vencimento, às 9h' },
]

/** Mais → Notificações: liga, testa e desliga os lembretes neste aparelho. */
export function Notificacoes() {
  const consulta = useEstadoNotificacoes()
  const estado = consulta.data

  return (
    <Pagina titulo="Notificações">
      <div className="flex flex-col gap-6">
        {consulta.isPending ? (
          <Skeleton className="h-40" />
        ) : estado === 'ligado' ? (
          <Ligado />
        ) : estado === 'desligado' ? (
          <Desligado />
        ) : estado === 'bloqueado' ? (
          <Bloqueado />
        ) : estado === 'instalar-iphone' ? (
          <InstalarIphone />
        ) : estado === 'indisponivel' ? (
          <Cartao icone={BellSlashIcon} tom="apagado" titulo="Ainda não disponível">
            <p>As notificações ainda não estão prontas neste aparelho. Recarregue a página e tente de novo.</p>
          </Cartao>
        ) : (
          <Cartao icone={BellSlashIcon} tom="apagado" titulo="Este navegador não recebe notificações">
            <p>Use o Chrome, o Edge, o Firefox ou o Safari atualizados para receber os lembretes.</p>
          </Cartao>
        )}

        <ResumoDaManha />

        <OQueAvisar />
      </div>
    </Pagina>
  )
}

/** Liga e desliga cada categoria de aviso (preferência da conta: vale em todos os aparelhos). */
function OQueAvisar() {
  const consulta = useAvisos()
  const salvar = useSalvarAvisos()
  return (
    <section aria-labelledby="avisos-titulo" className="flex flex-col gap-3">
      <h2 id="avisos-titulo" className="text-xl font-bold">
        O que avisar
      </h2>
      <p className="text-base text-muted-foreground">Desligue o que não quer receber. Vale para todos os seus aparelhos.</p>
      {consulta.isPending ? (
        <Skeleton className="h-60" />
      ) : consulta.isError ? (
        <p className="text-muted-foreground">Não foi possível carregar as preferências.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-linha rounded-2xl bg-folha px-4 shadow-folha">
          {O_QUE_AVISA.map(({ categoria, icone: Icone, area, titulo, texto }) => (
            <li key={categoria} className={`area-${area} flex items-center gap-4 py-3`}>
              <span className="selo-area size-11" aria-hidden>
                <Icone className="size-6" weight="fill" />
              </span>
              <Label htmlFor={`aviso-${categoria}`} className="flex flex-1 flex-col items-start gap-0.5">
                <span className="text-lg">{titulo}</span>
                <span className="text-base font-normal text-muted-foreground">{texto}</span>
              </Label>
              <Switch
                id={`aviso-${categoria}`}
                checked={consulta.data[categoria]}
                onCheckedChange={(ligar) =>
                  salvar.mutate(
                    { [categoria]: ligar },
                    { onSuccess: () => toast.success(ligar ? `Avisos de ${titulo.toLowerCase()} ligados.` : `Avisos de ${titulo.toLowerCase()} desligados.`) },
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Liga/desliga e escolhe a hora do resumo (preferência da conta, não do aparelho). */
function ResumoDaManha() {
  const consulta = useResumo()
  const salvar = useSalvarResumo()
  // Hora sendo digitada; salva ao sair do campo (não a cada dígito).
  const [editando, setEditando] = useState<string | null>(null)
  if (consulta.isPending) return <Skeleton className="h-36" />
  if (!consulta.data) return null
  const { ativo, hora } = consulta.data

  function salvarHora() {
    if (editando && editando !== hora && /^\d{2}:\d{2}$/.test(editando)) {
      salvar.mutate({ ativo, hora: editando }, { onSettled: () => setEditando(null) })
    } else {
      setEditando(null)
    }
  }

  return (
    <section aria-labelledby="resumo-titulo" className="flex flex-col gap-3">
      <h2 id="resumo-titulo" className="text-xl font-bold">
        Resumo da manhã
      </h2>
      <div className="flex flex-col gap-4 rounded-2xl bg-folha p-4 shadow-folha">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="resumo-ativo" className="text-lg">
            Receber o resumo do dia
          </Label>
          <Switch
            id="resumo-ativo"
            checked={ativo}
            disabled={salvar.isPending}
            onCheckedChange={(ligar) => salvar.mutate({ ativo: ligar, hora })}
          />
        </div>
        <p className="text-base text-muted-foreground">
          Um aviso por dia com os agendamentos, remédios, compromissos e contas de hoje. Em dia sem nada, não avisa.
        </p>
        {ativo && (
          <Campo
            rotulo="Horário"
            type="time"
            value={editando ?? hora}
            onChange={(e) => setEditando(e.target.value)}
            onBlur={salvarHora}
            className="sm:max-w-56"
          />
        )}
      </div>
    </section>
  )
}

type Tom = 'area' | 'ok' | 'apagado' | 'atraso'

const TONS: Record<Tom, string> = {
  area: 'bg-area-fundo text-area',
  ok: 'bg-ok-fundo text-ok',
  apagado: 'bg-suave text-muted-foreground',
  atraso: 'bg-atraso-fundo text-atraso',
}

/** O estado do aparelho é um objeto de verdade: folha com sombra e o sino num selo. */
function Cartao({ icone: Icone, tom = 'area', titulo, children }: { icone: Icon; tom?: Tom; titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-folha p-5 shadow-folha">
      <div className="flex items-center gap-3">
        <span className={cn('grid size-12 shrink-0 place-items-center rounded-lg', TONS[tom])} aria-hidden>
          <Icone className="size-7" weight="fill" />
        </span>
        <h2 className="text-xl font-bold">{titulo}</h2>
      </div>
      <div className="flex flex-col gap-4 text-lg">{children}</div>
    </section>
  )
}

function Ligado() {
  const testar = useTestarNotificacao()
  const desativar = useDesativarNotificacoes()
  return (
    <Cartao icone={BellRingingIcon} tom="ok" titulo="Ligadas neste aparelho">
      <p>Os lembretes chegam aqui mesmo com o app fechado.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={() => testar.mutate()} disabled={testar.isPending}>
          {testar.isPending ? 'Enviando…' : 'Enviar notificação de teste'}
        </Button>
        <Button size="lg" variant="outline" onClick={() => desativar.mutate()} disabled={desativar.isPending}>
          {desativar.isPending ? 'Desligando…' : 'Desligar neste aparelho'}
        </Button>
      </div>
    </Cartao>
  )
}

function Desligado() {
  const ativar = useAtivarNotificacoes()
  return (
    <Cartao icone={BellSlashIcon} tom="apagado" titulo="Desligadas neste aparelho">
      <p>Ative para receber os lembretes mesmo com o app fechado. O aparelho vai pedir sua permissão.</p>
      <Button size="lg" className="sm:self-start" onClick={() => ativar.mutate()} disabled={ativar.isPending}>
        <BellRingingIcon aria-hidden />
        {ativar.isPending ? 'Ativando…' : 'Ativar notificações'}
      </Button>
    </Cartao>
  )
}

function Bloqueado() {
  return (
    <Cartao icone={BellSlashIcon} tom="atraso" titulo="Bloqueadas neste aparelho">
      <p>As notificações foram recusadas. Para receber os lembretes, libere de novo:</p>
      <ol className="ml-6 flex list-decimal flex-col gap-2">
        <li>
          No computador: clique no cadeado ao lado do endereço do site, em <strong>Notificações</strong>, e escolha{' '}
          <strong>Permitir</strong>.
        </li>
        <li>
          No celular com o app instalado: abra <strong>Configurações → Apps → Minha Assistente → Notificações</strong> e
          ligue.
        </li>
        <li>Depois, volte para esta tela.</li>
      </ol>
    </Cartao>
  )
}

function InstalarIphone() {
  return (
    <Cartao icone={PlusSquareIcon} titulo="No iPhone, instale o app primeiro">
      <p>O iPhone só manda notificações para apps instalados na Tela de Início (iOS 16.4 ou mais novo).</p>
      <ol className="flex flex-col gap-4" aria-label="Como instalar">
        <Passo numero={1}>
          No Safari, toque em <strong>Compartilhar</strong>{' '}
          <ExportIcon className="inline size-5 align-text-bottom text-primary" aria-label="(o quadrado com a seta para cima)" />{' '}
          na barra de baixo.
        </Passo>
        <Passo numero={2}>
          Role a lista e toque em <strong>Adicionar à Tela de Início</strong>, depois em <strong>Adicionar</strong>.
        </Passo>
        <Passo numero={3}>
          Abra a <strong>Minha Assistente</strong> pelo ícone novo na Tela de Início e volte a esta tela para ativar.
        </Passo>
      </ol>
    </Cartao>
  )
}

function Passo({ numero, children }: { numero: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-foreground"
      >
        {numero}
      </span>
      <span className="pt-1">{children}</span>
    </li>
  )
}
