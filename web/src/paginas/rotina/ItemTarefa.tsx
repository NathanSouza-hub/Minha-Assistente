import { LinhaMarcavel } from '@/components/Linha'
import { useConcluirTarefa } from '@/consultas/rotinas'
import { horaDe } from '@/lib/datas'
import type { TarefaDoDia } from '@/lib/tipos'

/** Círculo à esquerda marca e desmarca (como no Início); o texto abre o compromisso. */
export function ItemTarefa({ tarefa: t, desabilitada }: { tarefa: TarefaDoDia; desabilitada: boolean }) {
  const concluir = useConcluirTarefa(t.data)
  return (
    <LinhaMarcavel
      estado={t.concluida ? 'feito' : 'pendente'}
      marcar={{
        rotulo: t.titulo,
        papel: 'checkbox',
        marcado: t.concluida,
        desabilitado: desabilitada,
        aoMarcar: () => concluir.mutate({ rotinaId: t.rotinaId, concluida: !t.concluida }),
      }}
      titulo={t.titulo}
      para={`/rotina/${t.rotinaId}`}
      apoio={
        t.concluida && t.concluidaEm ? (
          `Feito às ${horaDe(t.concluidaEm)}`
        ) : t.hora ? (
          <span className="font-semibold tabular-nums">Às {t.hora}</span>
        ) : (
          'Qualquer hora'
        )
      }
    />
  )
}
