import { Link } from 'react-router'
import { Bloco, Vazio } from '@/components/Bloco'
import { SeloEstado } from '@/components/Estado'
import { useRecebiveis } from '@/consultas/recebiveis'
import { dataCurta, hojeISO, somarDias } from '@/lib/datas'
import { formatarCentavos } from '@/lib/dinheiro'
import { nomeDaOrigem } from './formulario'

const QUANTOS_RECEBIVEIS = 5

/** Topo de Recebíveis: o que ainda falta receber até 30 dias à frente (os atrasados primeiro, pela data prevista). */
export function ProximosRecebiveis() {
  const consulta = useRecebiveis({ fim: somarDias(hojeISO(), 30) })
  return (
    <Bloco titulo="A receber nos próximos 30 dias" area="recebiveis" consulta={consulta}>
      {() => {
        const abertos = consulta.data!.filter((r) => r.status !== 'recebido')
        if (abertos.length === 0) return <Vazio>Nada a receber nos próximos 30 dias.</Vazio>
        const restantes = abertos.length - QUANTOS_RECEBIVEIS
        return (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y divide-linha">
              {abertos.slice(0, QUANTOS_RECEBIVEIS).map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/recebiveis/${r.id}`}
                    className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-suave/60"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{r.descricao}</span>
                      <span className="text-apoio text-muted-foreground">
                        {nomeDaOrigem(r)}
                        {r.status === 'parcial' && ` · recebido ${formatarCentavos(r.recebidoCentavos)}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="font-bold tabular-nums">{formatarCentavos(r.saldoCentavos)}</span>
                      <span className="text-apoio text-muted-foreground">
                        {r.atrasado ? (
                          <SeloEstado estado="vencido">Atrasado ({dataCurta(r.dataPrevista)})</SeloEstado>
                        ) : (
                          `Previsto ${dataCurta(r.dataPrevista)}`
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {restantes > 0 && (
              <p className="text-base text-muted-foreground">
                E mais {restantes === 1 ? '1 recebível' : `${restantes} recebíveis`} nos próximos 30 dias.
              </p>
            )}
          </div>
        )
      }}
    </Bloco>
  )
}
