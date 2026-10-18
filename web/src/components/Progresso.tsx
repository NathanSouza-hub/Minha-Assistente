/** "2 de 5 doses tomadas" com barra, direto no papel; quando tudo foi feito, mostra `textoCompleto`. */
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
    <div className="flex flex-col gap-2">
      <p className="text-lg font-semibold" aria-live="polite">
        {feitos === total ? textoCompleto : texto}
      </p>
      <div className="h-2.5 rounded-full bg-linha" aria-hidden>
        <div
          className="h-full rounded-full bg-ok transition-[width]"
          style={{ width: `${(feitos / total) * 100}%` }}
        />
      </div>
    </div>
  )
}
