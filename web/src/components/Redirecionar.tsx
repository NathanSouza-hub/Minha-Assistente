import { Navigate, useLocation } from 'react-router'

/** Endereço antigo → novo, mantendo os parâmetros (ex.: /hoje?data=... → /?data=...). */
export function Redirecionar({ para }: { para: string }) {
  const { search } = useLocation()
  return <Navigate to={`${para}${search}`} replace />
}
