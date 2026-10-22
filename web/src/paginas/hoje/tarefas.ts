import { useNavigate } from 'react-router'
import type { Area } from '@/app/navegacao'
import { useMarcarTarefa } from '@/consultas/hoje'
import type { CategoriaTarefa, MarcacaoTarefa, TarefaHoje } from '@/lib/tipos'

/** Cor da área e o que o ✓ e o ✗ querem dizer em cada categoria. */
export const CATEGORIAS: Record<CategoriaTarefa, { area: Area; nome: string; feito: string; naoFeito: string }> = {
  remedio: { area: 'remedios', nome: 'Remédio', feito: 'Tomei', naoFeito: 'Não tomei' },
  despesa: { area: 'contas', nome: 'Conta', feito: 'Paguei', naoFeito: 'Não paguei' },
  agenda: { area: 'agenda', nome: 'Agendamento', feito: 'Fiz', naoFeito: 'Não fiz' },
  compromisso: { area: 'compromissos', nome: 'Compromisso', feito: 'Fiz', naoFeito: 'Não fiz' },
  atividade: { area: 'atividade', nome: 'Atividade física', feito: 'Fiz', naoFeito: 'Não fiz' },
  fisioterapia: { area: 'fisioterapia', nome: 'Fisioterapia', feito: 'Fiz', naoFeito: 'Não fiz' },
  radio: { area: 'radio', nome: 'Programa de rádio', feito: 'Realizado', naoFeito: 'Não realizado' },
  viagem: { area: 'viagens', nome: 'Viagem', feito: 'Realizado', naoFeito: 'Não realizado' },
  tarefa: { area: 'tarefas', nome: 'Lembrete', feito: 'Fiz', naoFeito: 'Não fiz' },
}

/** Marca a tarefa (tocar no estado já marcado volta para pendente). */
export function useMarcar(tarefa: TarefaHoje, data: string) {
  const marcar = useMarcarTarefa(data)
  const navegar = useNavigate()
  return (status: Exclude<MarcacaoTarefa, 'pendente'> | 'pendente') => {
    // Conta da equipe com valor a definir: o valor pago é informado no formulário dela.
    if (status === 'feito' && tarefa.concluirNoFormulario && tarefa.status !== 'feito') return navegar(tarefa.link)
    marcar.mutate({ tarefa, status: tarefa.status === status ? 'pendente' : status })
  }
}

/** Quanto tempo depois do horário a atividade ainda conta como "agora". */
const MINUTOS_DE_AGORA = 60

const minutos = (horario: string) => {
  const [h, m] = horario.split(':').map(Number)
  return h * 60 + m
}

/**
 * O destaque do Início: a atividade com horário que está acontecendo (começou há menos de uma
 * hora) ou, se nenhuma, a próxima pendente. `depois` é a seguinte.
 */
export function destaqueDoDia(tarefas: TarefaHoje[], agoraMin: number) {
  const abertas = tarefas.filter((t) => t.horario && (t.status === 'pendente' || t.status === 'atrasado'))
  const agoraMesmo = abertas.filter((t) => {
    const inicio = minutos(t.horario!)
    return inicio <= agoraMin && agoraMin - inicio < MINUTOS_DE_AGORA
  })
  const proximas = abertas.filter((t) => minutos(t.horario!) > agoraMin)
  const atual = agoraMesmo.at(-1) ?? proximas[0]
  if (!atual) return null
  const depois = proximas.find((t) => t !== atual) ?? null
  return { tarefa: atual, acontecendo: agoraMesmo.includes(atual), depois }
}
