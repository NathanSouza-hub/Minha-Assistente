/** "5511999990000" → "+55 11 99999-0000" (número brasileiro); outros, "+" e os dígitos. */
export function formatarTelefone(numero: string) {
  const br = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(numero)
  return br ? `+55 ${br[1]} ${br[2]}-${br[3]}` : `+${numero}`
}
