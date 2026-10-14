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
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <p className="text-lg font-semibold" aria-live="polite">
        {feitos === total ? textoCompleto : texto}
      </p>
      <div className="h-3 rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(feitos / total) * 100}%` }}
        />
      </div>
    </div>
  )
}
