import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from './api'

/**
 * Mostra no formulário o erro que veio da API.
 * `porCodigo` liga um código a um campo (ex.: EMAIL_EM_USO → email); o resto vai para `root`.
 * VALIDACAO do back-end vem como "campo: mensagem; campo2: mensagem" e é distribuído pelos campos.
 */
export function aplicarErroApi<T extends FieldValues>(
  erro: unknown,
  setError: UseFormSetError<T>,
  porCodigo: Partial<Record<string, Path<T>>> = {},
) {
  if (!(erro instanceof ApiError)) {
    setError('root', { message: 'Algo deu errado. Tente de novo em instantes.' })
    return
  }

  const campo = porCodigo[erro.codigo]
  if (campo) {
    setError(campo, { message: erro.message })
    return
  }

  if (erro.codigo === 'VALIDACAO') {
    const partes = erro.message.split('; ').map((parte) => parte.match(/^([\w.]+): (.+)$/))
    if (partes.every(Boolean)) {
      for (const [, nome, mensagem] of partes as RegExpMatchArray[]) {
        setError(nome as Path<T>, { message: mensagem })
      }
      return
    }
  }

  setError('root', { message: erro.message })
}
