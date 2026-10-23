import { LinhaMarcavel } from '@/components/Linha'
import { useConcluirTarefa } from '@/consultas/rotinas'
import { horaDe } from '@/lib/datas'
import type { TarefaDoDia } from '@/lib/tipos'

/** Círculo à esquerda marca e desmarca (como no Início); o texto abre o compromisso; a hora fica à direita. */
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
      valor={t.hora && !t.concluida && <span className="pr-2 text-apoio text-muted-foreground">{t.hora}</span>}
      apoio={t.concluida && t.concluidaEm ? `Feito às ${horaDe(t.concluidaEm)}` : !t.hora && 'Qualquer hora'}
    />
  )
}
