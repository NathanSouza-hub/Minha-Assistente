import { useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { CalendarBlankIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { Popover } from 'radix-ui'
import { Button } from '@/components/ui/button'
import {
  dataCurta,
  dataPorExtenso,
  deDataISO,
  hojeISO,
  inicioDaSemana,
  mesDe,
  nomeDoMes,
  somarDias,
  somarMeses,
} from '@/lib/datas'
import { cn } from '@/lib/utils'

/**
 * Seletor de período do app inteiro: o título do período ("Outubro de 2026", "Hoje, 13 de outubro")
 * é um botão que abre uma janelinha para escolher direto, sem ir de um em um pelas setas.
 * - `SeletorMes`: o ano (com setas) e os 12 meses numa grade;
 * - `SeletorDia`: o calendário do mês; o nome do mês abre a mesma grade de meses.
 * Datas sempre em texto ("AAAA-MM" e "AAAA-MM-DD", fuso de São Paulo, via lib/datas). `min`/`max`
 * (inclusive, no mesmo formato) desativam o que fica fora. `gatilho` troca o botão padrão (título
 * com ▾) por outro elemento clicável, ex.: o ícone de calendário no cabeçalho do Início.
 */

type Limites = { min?: string; max?: string }

type PropsBase = Limites & {
  /** Nome da janela para leitores de tela. */
  rotulo?: string
  /** Elemento que abre a janela (um <button>); sem ele, o texto do período com ▾. */
  gatilho?: ReactElement
}

export function SeletorMes({ mes, aoMudar, rotulo = 'Escolher o mês', gatilho, min, max }: PropsBase & {
  mes: string
  aoMudar: (mes: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const escolher = (novo: string) => {
    setAberto(false)
    if (novo !== mes) aoMudar(novo)
  }
  const atual = mesDe()
  return (
    <Janela aberto={aberto} aoAbrir={setAberto} rotulo={rotulo} gatilho={gatilho ?? <GatilhoTitulo texto={nomeDoMes(mes)} />}>
      <GradeMeses escolhido={mes} min={min} max={max} aoEscolher={escolher} />
      {!fora(atual, min?.slice(0, 7), max?.slice(0, 7)) && (
        <Button variant="ghost" className="self-center text-primary" onClick={() => escolher(atual)}>
          Este mês
        </Button>
      )}
    </Janela>
  )
}

export function SeletorDia({ data, aoMudar, rotulo = 'Escolher o dia', texto, gatilho, min, max }: PropsBase & {
  data: string
  aoMudar: (data: string) => void
  /** Texto do botão padrão (ex.: "Hoje, 13 de outubro"); sem ele, a data por extenso. */
  texto?: string
}) {
  const [aberto, setAberto] = useState(false)
  const escolher = (novo: string) => {
    setAberto(false)
    if (novo !== data) aoMudar(novo)
  }
  const hoje = hojeISO()
  return (
    <Janela
      aberto={aberto}
      aoAbrir={setAberto}
      rotulo={rotulo}
      gatilho={gatilho ?? <GatilhoTitulo texto={texto ?? dataPorExtenso(data)} />}
    >
      <GradeDias escolhido={data} min={min} max={max} aoEscolher={escolher} />
      {!fora(hoje, min, max) && (
        <Button variant="ghost" className="self-center text-primary" onClick={() => escolher(hoje)}>
          Hoje
        </Button>
      )}
    </Janela>
  )
}

/** Mês num formulário (rótulo em cima e o botão com a cara de um campo). */
export function CampoMes({ rotulo, mes, aoMudar, min, max }: Limites & {
  rotulo: string
  mes: string
  aoMudar: (mes: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-base leading-snug font-semibold">
        {rotulo}
      </span>
      <SeletorMes
        mes={mes}
        aoMudar={aoMudar}
        rotulo={rotulo}
        min={min}
        max={max}
        gatilho={<GatilhoCampo rotuladoPor={id} texto={nomeDoMes(mes)} />}
      />
    </div>
  )
}

/** Dia num formulário (rótulo em cima, o botão com a cara de um campo e o erro embaixo). */
export function CampoData({ rotulo, data, aoMudar, min, max, erro }: Limites & {
  rotulo: string
  data: string
  aoMudar: (data: string) => void
  erro?: string
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-base leading-snug font-semibold">
        {rotulo}
      </span>
      <SeletorDia
        data={data}
        aoMudar={aoMudar}
        rotulo={rotulo}
        min={min}
        max={max}
        gatilho={<GatilhoCampo rotuladoPor={id} texto={data ? dataCurta(data) : 'Escolher'} erro={erro} />}
      />
      {erro && (
        <p id={`${id}-erro`} className="text-base font-semibold text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}

// ——— Peças internas ———

const fora = (valor: string, min?: string, max?: string) => Boolean((min && valor < min) || (max && valor > max))

function Janela({ aberto, aoAbrir, rotulo, gatilho, children }: {
  aberto: boolean
  aoAbrir: (aberto: boolean) => void
  rotulo: string
  gatilho: ReactElement
  children: ReactNode
}) {
  const conteudo = useRef<HTMLDivElement>(null)
  return (
    <Popover.Root open={aberto} onOpenChange={aoAbrir}>
      <Popover.Trigger asChild>{gatilho}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={conteudo}
          aria-label={rotulo}
          align="start"
          sideOffset={6}
          collisionPadding={16}
          // Ao abrir, o foco vai para o período escolhido (as setas do teclado andam a partir dele).
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            const alvo = conteudo.current?.querySelector<HTMLElement>('[data-escolhido]') ?? conteudo.current?.querySelector('button')
            alvo?.focus()
          }}
          className="z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2 rounded-2xl border border-linha bg-folha p-3 text-base text-foreground shadow-[var(--shadow-destaque)] outline-none"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** O texto do período com ▾; herda a fonte de quem está em volta (o título da seção). */
function GatilhoTitulo({ texto, ...props }: { texto: string }) {
  return (
    <button
      type="button"
      title="Escolher outro período"
      className="-mx-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1.5 text-left outline-none hover:bg-suave focus-visible:ring-3 focus-visible:ring-ring/50"
      {...props}
    >
      {texto}
      <CaretDownIcon weight="bold" className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}

function GatilhoCampo({ texto, rotuladoPor, erro, ...props }: { texto: string; rotuladoPor: string; erro?: string }) {
  return (
    <button
      type="button"
      aria-labelledby={rotuladoPor}
      aria-describedby={erro ? `${rotuladoPor}-erro` : undefined}
      aria-invalid={erro ? true : undefined}
      className="flex h-12 w-full items-center justify-between gap-2 rounded-lg border-[1.5px] border-input bg-folha px-3 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 aria-invalid:border-destructive"
      {...props}
    >
      {texto}
      <CalendarBlankIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}

type Passo = { rotulo: string; ir: () => void; desativado?: boolean }

/** Título no meio (botão, se `aoTocar`) e as setas dos lados. */
function Cabecalho({ titulo, aoTocar, rotuloToque, anterior, proximo }: {
  titulo: string
  aoTocar?: () => void
  rotuloToque?: string
  anterior: Passo
  proximo: Passo
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <Button variant="ghost" size="icon" className="rounded-full" onClick={anterior.ir} disabled={anterior.desativado} aria-label={anterior.rotulo}>
        <CaretLeftIcon className="size-5" weight="bold" aria-hidden />
      </Button>
      {aoTocar ? (
        <button
          type="button"
          onClick={aoTocar}
          aria-label={`${titulo}: ${rotuloToque}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-[1.05rem] font-bold outline-none hover:bg-suave focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {titulo}
          <CaretDownIcon weight="bold" className="size-4 text-muted-foreground" aria-hidden />
        </button>
      ) : (
        <p className="text-[1.05rem] font-bold tabular-nums" aria-live="polite">
          {titulo}
        </p>
      )}
      <Button variant="ghost" size="icon" className="rounded-full" onClick={proximo.ir} disabled={proximo.desativado} aria-label={proximo.rotulo}>
        <CaretRightIcon className="size-5" weight="bold" aria-hidden />
      </Button>
    </div>
  )
}

/** Célula da grade: escolhido em azul cheio; o atual (este mês, hoje) com contorno azul. */
const celula = (escolhido: boolean, atual: boolean, apagado = false) =>
  cn(
    'min-h-11 rounded-xl font-semibold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-35',
    escolhido
      ? 'bg-primary text-primary-foreground'
      : cn('hover:bg-suave', atual && 'text-primary ring-[1.5px] ring-primary/50 ring-inset', apagado && 'text-muted-foreground'),
  )

/** Setas do teclado andam pela grade (passo 1 nos lados, `colunas` em cima e embaixo). */
function andarComSetas(colunas: number) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -colunas, ArrowDown: colunas } as Record<string, number>)[e.key]
    if (!passo) return
    const botoes = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const i = botoes.indexOf(document.activeElement as HTMLButtonElement)
    const alvo = botoes[i + passo]
    if (i < 0 || !alvo) return
    e.preventDefault()
    alvo.focus()
  }
}

const abreviado = (mes: string) => {
  const texto = deDataISO(`${mes}-01`).toFormat('LLL').replace('.', '')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function GradeMeses({ escolhido, min, max, aoEscolher }: Limites & { escolhido: string; aoEscolher: (mes: string) => void }) {
  const [ano, setAno] = useState(Number(escolhido.slice(0, 4)))
  const minMes = min?.slice(0, 7)
  const maxMes = max?.slice(0, 7)
  const atual = mesDe()
  return (
    <>
      <Cabecalho
        titulo={String(ano)}
        anterior={{ rotulo: 'Ano anterior', ir: () => setAno(ano - 1), desativado: fora(`${ano - 1}-12`, minMes) }}
        proximo={{ rotulo: 'Próximo ano', ir: () => setAno(ano + 1), desativado: fora(`${ano + 1}-01`, undefined, maxMes) }}
      />
      <div role="group" aria-label={`Meses de ${ano}`} className="grid grid-cols-3 gap-1.5" onKeyDown={andarComSetas(3)}>
        {Array.from({ length: 12 }, (_, i) => {
          const mes = `${ano}-${String(i + 1).padStart(2, '0')}`
          const e = mes === escolhido
          return (
            <button
              key={mes}
              type="button"
              aria-label={nomeDoMes(mes)}
              aria-pressed={e}
              data-escolhido={e || undefined}
              disabled={fora(mes, minMes, maxMes)}
              onClick={() => aoEscolher(mes)}
              className={celula(e, mes === atual)}
            >
              {abreviado(mes)}
            </button>
          )
        })}
      </div>
    </>
  )
}

const DIAS_DA_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

function GradeDias({ escolhido, min, max, aoEscolher }: Limites & { escolhido: string; aoEscolher: (data: string) => void }) {
  const [mes, setMes] = useState(mesDe(escolhido))
  const [vendoMeses, setVendoMeses] = useState(false)
  if (vendoMeses)
    return (
      <GradeMeses
        escolhido={mes}
        min={min}
        max={max}
        aoEscolher={(novo) => {
          setMes(novo)
          setVendoMeses(false)
        }}
      />
    )

  // Seis semanas sempre (seg→dom, como o calendário da Agenda): a janela não muda de altura.
  const primeiro = inicioDaSemana(`${mes}-01`)
  const dias = Array.from({ length: 42 }, (_, i) => somarDias(primeiro, i))
  const hoje = hojeISO()
  return (
    <>
      <Cabecalho
        titulo={nomeDoMes(mes)}
        aoTocar={() => setVendoMeses(true)}
        rotuloToque="escolher mês e ano"
        anterior={{ rotulo: 'Mês anterior', ir: () => setMes(somarMeses(mes, -1)), desativado: fora(somarDias(`${mes}-01`, -1), min) }}
        proximo={{ rotulo: 'Próximo mês', ir: () => setMes(somarMeses(mes, 1)), desativado: fora(`${somarMeses(mes, 1)}-01`, undefined, max) }}
      />
      <div className="grid grid-cols-7 text-center text-[0.8rem] font-bold text-muted-foreground" aria-hidden>
        {DIAS_DA_SEMANA.map((d) => (
          <span key={d}>{d.charAt(0)}</span>
        ))}
      </div>
      <div role="group" aria-label={nomeDoMes(mes)} className="-mt-1 grid grid-cols-7 gap-0.5" onKeyDown={andarComSetas(7)}>
        {dias.map((dia) => {
          const e = dia === escolhido
          return (
            <button
              key={dia}
              type="button"
              aria-label={dataPorExtenso(dia)}
              aria-pressed={e}
              data-escolhido={e || undefined}
              disabled={fora(dia, min, max)}
              onClick={() => aoEscolher(dia)}
              className={celula(e, dia === hoje, mesDe(dia) !== mes)}
            >
              {Number(dia.slice(8))}
            </button>
          )
        })}
      </div>
    </>
  )
}
