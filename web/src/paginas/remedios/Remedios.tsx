import { CircleCheck, Pill, Plus, Undo2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Pagina } from '@/components/layout/Pagina'
import { EstadoVazio } from '@/components/EstadoVazio'
import { NavegadorDia } from '@/components/NavegadorDia'
import { Progresso } from '@/components/Progresso'
import { Opcoes } from '@/components/Opcoes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDosesDoDia, useMedicamentos, useRegistrarDose } from '@/consultas/medicamentos'
import { hojeISO, horaDe } from '@/lib/datas'
import type { DoseDoDia, PeriodoRemedio } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { descreverHorario } from './textos'

type Visao = 'hoje' | 'lista'

const GRUPOS: { periodo: PeriodoRemedio; titulo: string }[] = [
  { periodo: 'manha', titulo: 'Manhã' },
  { periodo: 'tarde', titulo: 'Tarde' },
  { periodo: 'noite', titulo: 'Noite' },
  { periodo: 'semanal', titulo: 'Remédio da semana' },
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
            <Plus aria-hidden />
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
            <Skeleton key={n} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : consulta.isError ? (
        <EstadoVazio
          icone={Pill}
          titulo="Não foi possível carregar os remédios"
          acao={<Button onClick={() => consulta.refetch()}>Tentar de novo</Button>}
        >
          Verifique a internet e tente de novo.
        </EstadoVazio>
      ) : doses.length === 0 ? (
        <EstadoVazio
          icone={Pill}
          titulo="Nenhum remédio para este dia"
          acao={
            <Button asChild>
              <Link to="/remedios/novo">Cadastrar remédio</Link>
            </Button>
          }
        >
          Remédios pausados não aparecem aqui.
        </EstadoVazio>
      ) : (
        <>
          <Progresso
            feitos={tomadas}
            total={doses.length}
            texto={`${tomadas} de ${doses.length} ${doses.length === 1 ? 'dose tomada' : 'doses tomadas'}`}
            textoCompleto="Tudo tomado neste dia."
          />
          {GRUPOS.map(({ periodo, titulo }) => {
            const doGrupo = doses.filter((d) => d.periodo === periodo)
            if (!doGrupo.length) return null
            return (
              <section key={periodo} className="flex flex-col gap-3" aria-labelledby={`grupo-${periodo}`}>
                <h3 id={`grupo-${periodo}`} className="text-lg font-bold">
                  {titulo}
                </h3>
                <ul className="flex flex-col gap-3">
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

function ItemDose({ dose: d, futuro }: { dose: DoseDoDia; futuro: boolean }) {
  const registrar = useRegistrarDose(d.data)
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center',
        d.tomado && 'bg-secondary/60',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-lg font-bold">
          {d.nome}
          {d.hora && <span className="ml-2 font-semibold text-muted-foreground tabular-nums">{d.hora}</span>}
        </p>
        {d.dose && <p className="text-base">{d.dose}</p>}
        {d.observacoes && <p className="text-base text-muted-foreground">{d.observacoes}</p>}
      </div>
      {d.tomado ? (
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <p className="flex items-center gap-1.5 font-semibold text-primary">
            <CircleCheck className="size-6" aria-hidden />
            {d.tomadoEm ? `Tomado às ${horaDe(d.tomadoEm)}` : 'Tomado'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => registrar.mutate({ horarioId: d.horarioId, tomado: false })}
            aria-label={`Desfazer: ${d.nome} não foi tomado`}
          >
            <Undo2 aria-hidden />
            Desfazer
          </Button>
        </div>
      ) : futuro ? (
        <p className="text-base text-muted-foreground">Ainda não chegou o dia.</p>
      ) : (
        <Button
          size="lg"
          onClick={() => registrar.mutate({ horarioId: d.horarioId, tomado: true })}
          aria-label={`Tomei ${d.nome}`}
          className="w-full sm:w-auto"
        >
          <CircleCheck aria-hidden />
          Tomei
        </Button>
      )}
    </li>
  )
}

function MeusRemedios() {
  const consulta = useMedicamentos()
  const remedios = consulta.data ?? []

  if (consulta.isPending) return <Skeleton className="h-40 rounded-xl" />
  if (remedios.length === 0) {
    return (
      <EstadoVazio
        icone={Pill}
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
    <ul className="flex flex-col gap-3" aria-label="Meus remédios">
      {remedios.map((m) => (
        <li key={m.id}>
          <Link
            to={`/remedios/${m.id}`}
            className={cn(
              'flex flex-col gap-1 rounded-xl border bg-card p-4 hover:bg-muted/60',
              !m.ativo && 'bg-card/60',
            )}
          >
            <span className="flex items-center justify-between gap-3">
              <span className={cn('text-lg font-bold', !m.ativo && 'text-muted-foreground')}>{m.nome}</span>
              {!m.ativo && (
                <span className="rounded-md bg-muted px-2 font-semibold text-muted-foreground">Pausado</span>
              )}
            </span>
            {m.dose && <span className="text-base">{m.dose}</span>}
            <span className="text-base text-muted-foreground">
              {m.horarios.map(descreverHorario).join('; ')}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
