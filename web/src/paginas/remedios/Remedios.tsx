import { CalendarCheckIcon, MoonIcon, PillIcon, PlusIcon, SunHorizonIcon, SunIcon, type Icon } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { NavegadorDia } from '@/components/NavegadorDia'
import { Progresso } from '@/components/Progresso'
import { Opcoes } from '@/components/Opcoes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDosesDoDia, useMedicamentos } from '@/consultas/medicamentos'
import { dataCurta, hojeISO } from '@/lib/datas'
import type { PeriodoRemedio } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { ItemDose } from './ItemDose'
import { descreverHorario } from './textos'

type Visao = 'hoje' | 'lista'

const GRUPOS: { periodo: PeriodoRemedio; titulo: string; icone: Icon }[] = [
  { periodo: 'manha', titulo: 'Manhã', icone: SunHorizonIcon },
  { periodo: 'tarde', titulo: 'Tarde', icone: SunIcon },
  { periodo: 'noite', titulo: 'Noite', icone: MoonIcon },
  { periodo: 'semanal', titulo: 'Remédio da semana', icone: CalendarCheckIcon },
]

export function Remedios() {
  const [params, setParams] = useSearchParams()
  const visao: Visao = params.get('visao') === 'lista' ? 'lista' : 'hoje'
  const data = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') ?? '') ? params.get('data')! : hojeISO()

  const mudar = (mudancas: { visao?: Visao; data?: string }) =>
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual)
        if (mudancas.visao) {
          if (mudancas.visao === 'hoje') novo.delete('visao')
          else novo.set('visao', mudancas.visao)
        }
        if (mudancas.data) {
          if (mudancas.data === hojeISO()) novo.delete('data')
          else novo.set('data', mudancas.data)
        }
        return novo
      },
      { replace: true },
    )

  return (
    <Pagina
      titulo="Remédios"
      acoes={
        <Button asChild size="lg">
          <Link to="/remedios/novo">
            <PlusIcon weight="bold" aria-hidden />
            Novo
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Opcoes<Visao>
          rotulo="Mostrar"
          rotuloOculto
          formato="segmentos"
          valor={visao}
          aoMudar={(v) => mudar({ visao: v })}
          opcoes={[
            { valor: 'hoje', rotulo: 'Doses do dia' },
            { valor: 'lista', rotulo: 'Meus remédios' },
          ]}
        />
        {visao === 'hoje' ? (
          <DosesDoDia data={data} mudarData={(d) => mudar({ data: d })} />
        ) : (
          <MeusRemedios />
        )}
      </div>
    </Pagina>
  )
}

function DosesDoDia({ data, mudarData }: { data: string; mudarData: (d: string) => void }) {
  const consulta = useDosesDoDia(data)
  const doses = consulta.data ?? []
  const tomadas = doses.filter((d) => d.tomado).length
  const futuro = data > hojeISO()

  return (
    <>
      <NavegadorDia data={data} aoMudar={mudarData} />

      {consulta.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando remédios">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20" />
          ))}
        </div>
      ) : consulta.isError ? (
        <EstadoVazio
          icone={PillIcon}
          titulo="Não foi possível carregar os remédios"
          acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
        >
          Verifique a internet e tente de novo.
        </EstadoVazio>
      ) : doses.length === 0 ? (
        <EstadoVazio
          icone={PillIcon}
          titulo="Nenhum remédio para este dia"
          acao={
            <Button asChild>
              <Link to="/remedios/novo">Cadastrar remédio</Link>
            </Button>
          }
        >
          Remédios pausados ou fora do período de uso não aparecem aqui.
        </EstadoVazio>
      ) : (
        <>
          <Progresso
            feitos={tomadas}
            total={doses.length}
            texto={`${tomadas} de ${doses.length} ${doses.length === 1 ? 'dose tomada' : 'doses tomadas'}`}
            textoCompleto="Tudo tomado neste dia."
          />
          {GRUPOS.map(({ periodo, titulo, icone: Icone }) => {
            const doGrupo = doses.filter((d) => d.periodo === periodo)
            if (!doGrupo.length) return null
            return (
              <section key={periodo} className="flex flex-col" aria-labelledby={`grupo-${periodo}`}>
                <h3 id={`grupo-${periodo}`} className="flex items-center gap-2.5 text-lg font-bold">
                  <span className="selo-area size-9" aria-hidden>
                    <Icone className="size-5" weight="fill" />
                  </span>
                  {titulo}
                </h3>
                <ul className="flex flex-col divide-y divide-linha">
                  {doGrupo.map((d) => (
                    <ItemDose key={d.horarioId} dose={d} futuro={futuro} />
                  ))}
                </ul>
              </section>
            )
          })}
        </>
      )}
    </>
  )
}

/** "Desde 20/10/2026", "De 20/10/2026 até 27/10/2026", "Terminou em 27/10/2026". */
function descreverPeriodo(inicio: string | null, fim: string | null) {
  if (fim && fim < hojeISO()) return `Terminou em ${dataCurta(fim)}`
  if (inicio && fim) return `De ${dataCurta(inicio)} até ${dataCurta(fim)}`
  if (fim) return `Até ${dataCurta(fim)}`
  return inicio! > hojeISO() ? `Começa em ${dataCurta(inicio!)}` : `Desde ${dataCurta(inicio!)}`
}

function MeusRemedios() {
  const consulta = useMedicamentos()
  const remedios = consulta.data ?? []

  if (consulta.isPending) return <Skeleton className="h-40" />
  if (remedios.length === 0) {
    return (
      <EstadoVazio
        icone={PillIcon}
        titulo="Nenhum remédio cadastrado"
        acao={
          <Button asChild>
            <Link to="/remedios/novo">Cadastrar remédio</Link>
          </Button>
        }
      >
        Cadastre cada remédio com os horários; o app avisa e marca o que já foi tomado.
      </EstadoVazio>
    )
  }
  return (
    <ul className="flex flex-col divide-y divide-linha" aria-label="Meus remédios">
      {remedios.map((m) => (
        <li key={m.id}>
          <Link
            to={`/remedios/${m.id}`}
            className="-mx-2 my-1 flex flex-col gap-0.5 rounded-lg px-2 py-3 hover:bg-suave/70"
          >
            <span className="flex items-center justify-between gap-3">
              <span className={cn('text-lg font-bold', !m.ativo && 'text-muted-foreground')}>{m.nome}</span>
              {!m.ativo && (
                <span className="rounded-full bg-suave px-2.5 font-semibold text-muted-foreground">Pausado</span>
              )}
            </span>
            {m.dose && <span className="text-base">{m.dose}</span>}
            <span className="text-base text-muted-foreground">
              {m.intervaloHoras && `A cada ${m.intervaloHoras} horas: `}
              {m.horarios.map(descreverHorario).join('; ')}
            </span>
            {(m.dataInicio || m.dataFim) && (
              <span className="text-base text-muted-foreground">{descreverPeriodo(m.dataInicio, m.dataFim)}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
