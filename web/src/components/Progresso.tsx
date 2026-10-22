/** Barra fina com "2 de 5 doses tomadas" ao lado (como no Início); quando tudo foi feito, mostra `textoCompleto`. */
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
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-contorno/70" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(feitos / total) * 100}%` }}
        />
      </div>
      <p className="shrink-0 text-apoio font-semibold text-muted-foreground" aria-live="polite">
        {feitos === total ? textoCompleto : texto}
      </p>
    </div>
  )
}
