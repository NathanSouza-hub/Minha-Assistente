import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircleIcon, WhatsappLogoIcon, type Icon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Confirmar } from '@/components/Confirmar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDesvincularWhatsapp, useGerarCodigoWhatsapp, useSituacaoWhatsapp, useTestarWhatsapp } from '@/consultas/whatsapp'
import { dataCurta, diaDe, horaDe } from '@/lib/datas'
import { formatarTelefone } from '@/lib/telefone'
import type { CodigoWhatsapp, SituacaoWhatsapp } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/**
 * Configurações → WhatsApp (decisão 38): liga o número da pessoa à conta por um código de 6 dígitos
 * que ela manda para o número do app. O número ligado recebe os lembretes (os mesmos do app) e, com
 * o assistente ligado no servidor, lança contas, compromissos e tarefas por mensagem.
 */
export function Whatsapp() {
  const [codigo, setCodigo] = useState<CodigoWhatsapp | null>(null)
  const consulta = useSituacaoWhatsapp(Boolean(codigo))
  const situacao = consulta.data

  // O código foi usado (a tela relê enquanto ele aparece): avisa e volta para a situação ligada.
  const esperando = useRef(false)
  useEffect(() => {
    if (codigo) esperando.current = true
    if (esperando.current && situacao?.vinculado) {
      esperando.current = false
      setCodigo(null)
      toast.success('Pronto! Seu WhatsApp está ligado à sua conta.')
    }
  }, [codigo, situacao?.vinculado])

  return (
    <Pagina titulo="WhatsApp">
      <div className="flex flex-col gap-6 sm:max-w-xl">
        {consulta.isPending ? (
          <Skeleton className="h-48" />
        ) : !situacao ? null : !situacao.disponivel ? (
          <Cartao titulo="Ainda não disponível" tom="apagado">
            <p>O WhatsApp ainda não foi configurado neste servidor.</p>
          </Cartao>
        ) : codigo ? (
          <MandeOCodigo codigo={codigo} aoCancelar={() => setCodigo(null)} />
        ) : situacao.vinculado ? (
          <Ligado situacao={situacao} aoGerar={setCodigo} />
        ) : (
          <Desligado numero={situacao.numero!} assistente={situacao.assistente} aoGerar={setCodigo} />
        )}
      </div>
    </Pagina>
  )
}

type Tom = 'ok' | 'apagado'

function Cartao({ titulo, tom, icone: Icone = WhatsappLogoIcon, children }: { titulo: string; tom: Tom; icone?: Icon; children: ReactNode }) {
  return (
    <section className="superficie flex flex-col gap-4 p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-lg',
            tom === 'ok' ? 'bg-ok-fundo text-ok' : 'bg-suave text-muted-foreground',
          )}
          aria-hidden
        >
          <Icone className="size-5" weight="fill" />
        </span>
        <h2 className="text-secao font-bold">{titulo}</h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function BotaoGerar({ rotulo, variant, aoGerar }: { rotulo: string; variant?: 'outline'; aoGerar: (c: CodigoWhatsapp) => void }) {
  const gerar = useGerarCodigoWhatsapp()
  return (
    <Button size="lg" variant={variant} className="sm:self-start" disabled={gerar.isPending} onClick={() => gerar.mutate(undefined, { onSuccess: aoGerar })}>
      {gerar.isPending ? 'Gerando…' : rotulo}
    </Button>
  )
}

function Desligado({ numero, assistente, aoGerar }: { numero: string; assistente: boolean; aoGerar: (c: CodigoWhatsapp) => void }) {
  return (
    <Cartao titulo="Ligar o seu WhatsApp" tom="apagado">
      <p>
        Ligue o seu número à sua conta para receber os lembretes também pelo WhatsApp
        {assistente
          ? ' e anotar contas, compromissos e tarefas mandando mensagem.'
          : '. Logo você vai poder anotar contas e agendamentos mandando mensagem.'}
      </p>
      <ol className="flex list-decimal flex-col gap-1 pl-5">
        <li>Toque em “Gerar código”.</li>
        <li>
          Mande o código para o número do app, <strong className="whitespace-nowrap">{formatarTelefone(numero)}</strong>.
        </li>
      </ol>
      <BotaoGerar rotulo="Gerar código" aoGerar={aoGerar} />
    </Cartao>
  )
}

function MandeOCodigo({ codigo, aoCancelar }: { codigo: CodigoWhatsapp; aoCancelar: () => void }) {
  return (
    <Cartao titulo="Mande este código pelo WhatsApp" tom="apagado">
      <p
        aria-label={`Código ${codigo.codigo.split('').join(' ')}`}
        className="font-heading text-4xl font-bold tracking-[0.3em] tabular-nums"
      >
        {codigo.codigo}
      </p>
      <p>
        Envie para <strong className="whitespace-nowrap">{formatarTelefone(codigo.numero)}</strong>. O código vale até{' '}
        {horaDe(codigo.expiraEm)}. Esta tela atualiza sozinha quando a mensagem chegar.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" variant="confirmar" asChild>
          <a href={codigo.link} target="_blank" rel="noreferrer">
            <WhatsappLogoIcon weight="fill" aria-hidden />
            Abrir o WhatsApp
          </a>
        </Button>
        <Button size="lg" variant="outline" onClick={aoCancelar}>
          Cancelar
        </Button>
      </div>
    </Cartao>
  )
}

function Exemplos() {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-suave p-3 md:p-4">
      <h3 className="font-semibold">Mande mensagens como</h3>
      <ul className="flex flex-col gap-1">
        <li>“almoço 45,90”</li>
        <li>“conta de luz 230 vence dia 10”</li>
        <li>“dentista dia 18 às 15h”</li>
        <li>“ligar para o banco amanhã às 9h”</li>
      </ul>
      <p className="text-muted-foreground">Errou? Mande “desfazer” e o último lançamento sai.</p>
    </div>
  )
}

function Ligado({ situacao, aoGerar }: { situacao: SituacaoWhatsapp; aoGerar: (c: CodigoWhatsapp) => void }) {
  const desvincular = useDesvincularWhatsapp()
  const testar = useTestarWhatsapp()
  return (
    <Cartao titulo="WhatsApp ligado" tom="ok" icone={CheckCircleIcon}>
      <p>
        Número {situacao.telefone}
        {situacao.vinculadoEm && `, ligado em ${dataCurta(diaDe(situacao.vinculadoEm))}`}. Os lembretes chegam por
        lá também, os mesmos do app (Notificações → O que avisar).
        {!situacao.assistente && ' Em breve você vai poder anotar contas e agendamentos por lá.'}
      </p>
      {situacao.assistente && <Exemplos />}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button size="lg" disabled={testar.isPending} onClick={() => testar.mutate()}>
          {testar.isPending ? 'Enviando…' : 'Enviar lembrete de teste'}
        </Button>
        <BotaoGerar rotulo="Trocar de número" variant="outline" aoGerar={aoGerar} />
        <Confirmar
          gatilho={
            <Button size="lg" variant="outline" disabled={desvincular.isPending}>
              {desvincular.isPending ? 'Desligando…' : 'Desligar'}
            </Button>
          }
          titulo="Desligar o WhatsApp?"
          descricao="O número deixa de falar com a sua conta. Para ligar de novo, é só gerar outro código."
          confirmar="Desligar WhatsApp"
          aoConfirmar={() => desvincular.mutate()}
        />
      </div>
    </Cartao>
  )
}
