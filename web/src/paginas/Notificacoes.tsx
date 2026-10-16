import type { ReactNode } from 'react'
import { BellOff, BellRing, CalendarDays, ListChecks, Pill, Share, SquarePlus, Wallet } from 'lucide-react'
import { Pagina } from '@/components/layout/Pagina'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAtivarNotificacoes,
  useDesativarNotificacoes,
  useEstadoNotificacoes,
  useTestarNotificacao,
} from '@/consultas/notificacoes'

const O_QUE_AVISA = [
  { icone: CalendarDays, texto: 'Agendamentos, com a antecedência que você escolher' },
  { icone: Pill, texto: 'Remédios, na hora de cada dose' },
  { icone: ListChecks, texto: 'Compromissos que têm lembrete' },
  { icone: Wallet, texto: 'Contas a pagar, na véspera e no dia, às 9h' },
]

/** Mais → Notificações: liga, testa e desliga os lembretes neste aparelho. */
export function Notificacoes() {
  const consulta = useEstadoNotificacoes()
  const estado = consulta.data

  return (
    <Pagina titulo="Notificações">
      <div className="flex flex-col gap-6">
        {consulta.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : estado === 'ligado' ? (
          <Ligado />
        ) : estado === 'desligado' ? (
          <Desligado />
        ) : estado === 'bloqueado' ? (
          <Bloqueado />
        ) : estado === 'instalar-iphone' ? (
          <InstalarIphone />
        ) : estado === 'indisponivel' ? (
          <Cartao icone={<BellOff className="size-8 text-muted-foreground" aria-hidden />} titulo="Ainda não disponível">
            <p>As notificações ainda não estão prontas neste aparelho. Recarregue a página e tente de novo.</p>
          </Cartao>
        ) : (
          <Cartao icone={<BellOff className="size-8 text-muted-foreground" aria-hidden />} titulo="Este navegador não recebe notificações">
            <p>Use o Chrome, o Edge, o Firefox ou o Safari atualizados para receber os lembretes.</p>
          </Cartao>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">O que é avisado</h2>
          <ul className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            {O_QUE_AVISA.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-center gap-3">
                <Icone className="size-6 shrink-0 text-primary" aria-hidden />
                {texto}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Pagina>
  )
}

function Cartao({ icone, titulo, children }: { icone: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        {icone}
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
    <Cartao icone={<BellRing className="size-8 text-primary" aria-hidden />} titulo="Ligadas neste aparelho">
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
    <Cartao icone={<BellOff className="size-8 text-muted-foreground" aria-hidden />} titulo="Desligadas neste aparelho">
      <p>Ative para receber os lembretes mesmo com o app fechado. O aparelho vai pedir sua permissão.</p>
      <Button size="lg" className="sm:self-start" onClick={() => ativar.mutate()} disabled={ativar.isPending}>
        <BellRing aria-hidden />
        {ativar.isPending ? 'Ativando…' : 'Ativar notificações'}
      </Button>
    </Cartao>
  )
}

function Bloqueado() {
  return (
    <Cartao icone={<BellOff className="size-8 text-atraso" aria-hidden />} titulo="Bloqueadas neste aparelho">
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
    <Cartao icone={<SquarePlus className="size-8 text-primary" aria-hidden />} titulo="No iPhone, instale o app primeiro">
      <p>O iPhone só manda notificações para apps instalados na Tela de Início (iOS 16.4 ou mais novo).</p>
      <ol className="flex flex-col gap-4" aria-label="Como instalar">
        <Passo numero={1}>
          No Safari, toque em <strong>Compartilhar</strong>{' '}
          <Share className="inline size-5 align-text-bottom text-primary" aria-label="(o quadrado com a seta para cima)" />{' '}
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
