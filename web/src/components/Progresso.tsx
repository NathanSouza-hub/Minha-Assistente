/** "2 de 5 doses tomadas" com barra; quando tudo foi feito, mostra `textoCompleto`. */
export function Progresso({
  feitos,
  total,
  texto,
  textoCompleto,
}: {
  feitos: number
  total: number
  texto: string
  textoCompleto: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-folha p-4 shadow-folha">
      <p className="text-lg font-semibold" aria-live="polite">
        {feitos === total ? textoCompleto : texto}
      </p>
      <div className="h-3 rounded-full bg-areia" aria-hidden>
        <div
          className="h-full rounded-full bg-ok transition-[width]"
          style={{ width: `${(feitos / total) * 100}%` }}
        />
      </div>
    </div>
  )
}
