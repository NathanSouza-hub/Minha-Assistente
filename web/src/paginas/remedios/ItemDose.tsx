import { ArrowCounterClockwiseIcon, PencilSimpleIcon, XIcon } from '@phosphor-icons/react'
import { SeloEstado } from '@/components/Estado'
import { LinhaMarcavel, MenuLinha, type AcaoLinha } from '@/components/Linha'
import { useRegistrarDose } from '@/consultas/medicamentos'
import { horaDe } from '@/lib/datas'
import type { DoseDoDia } from '@/lib/tipos'

/**
 * Uma dose: o círculo à esquerda é o "Tomei" (tocar de novo desfaz); "Não tomei" e "Voltar para
 * pendente" ficam no ⋯, como no Início. Em dia que ainda não chegou, o círculo só mostra o estado.
 */
export function ItemDose({ dose: d, futuro }: { dose: DoseDoDia; futuro: boolean }) {
  const registrar = useRegistrarDose(d.data)
  const marcar = (situacao: DoseDoDia['situacao']) => registrar.mutate({ horarioId: d.horarioId, situacao })
  const tomado = d.situacao === 'tomado'

  const acoes: AcaoLinha[] = []
  if (!futuro && d.situacao !== 'nao_tomado')
    acoes.push({ rotulo: 'Não tomei', icone: XIcon, aoEscolher: () => marcar('nao_tomado') })
  if (d.situacao === 'nao_tomado')
    acoes.push({ rotulo: 'Voltar para pendente', icone: ArrowCounterClockwiseIcon, aoEscolher: () => marcar('pendente') })
  acoes.push({ rotulo: 'Editar remédio', icone: PencilSimpleIcon, para: `/remedios/${d.medicamentoId}` })

  return (
    <LinhaMarcavel
      estado={tomado ? 'feito' : d.situacao === 'nao_tomado' ? 'nao_feito' : 'pendente'}
      marcar={
        futuro
          ? undefined
          : {
              rotulo: tomado ? `Desfazer: ${d.nome} não foi tomado` : `Tomei ${d.nome}`,
              marcado: tomado,
              aoMarcar: () => marcar(tomado ? 'pendente' : 'tomado'),
            }
      }
      titulo={d.nome}
      apoio={
        <>
          <p>
            {d.hora && <span className="font-semibold tabular-nums">{d.hora}</span>}
            {d.hora && d.dose && <span aria-hidden> · </span>}
            {d.dose}
          </p>
          {tomado && (
            <SeloEstado estado="feito">{d.tomadoEm ? `Tomado às ${horaDe(d.tomadoEm)}` : 'Tomado'}</SeloEstado>
          )}
          {d.situacao === 'nao_tomado' && <SeloEstado estado="nao_feito">Não tomado</SeloEstado>}
          {d.observacoes && <p>{d.observacoes}</p>}
          {futuro && d.situacao === 'pendente' && <p>Ainda não chegou o dia.</p>}
        </>
      }
      fim={<MenuLinha titulo={d.nome} descricao={[d.hora, d.dose].filter(Boolean).join(' · ')} acoes={acoes} />}
    />
  )
}
